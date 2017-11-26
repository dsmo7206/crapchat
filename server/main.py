#!/usr/bin/env python3

import asyncio
import uvloop

# uvloop is a faster drop-in replacement for the asyncio event loop
asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())

import aiohttp
import aiohttp_jinja2
import aiopg
import datetime
import jinja2
import json
import jwt
import pytz
import sys

import common
import data
import listener

from aiohttp import web as aiohttp_web
from collections import defaultdict
from passlib.hash import argon2

APP_NAME = 'Crapchat!'
JWT_SECRET = 'secret' # Change this or load from database instead - it MUST be private

@aiohttp_jinja2.template('index.html')
def handle_root(request):
    return {'page_title': APP_NAME}

async def notify(cursor, payload_object):
    await cursor.execute('NOTIFY channel, %s', (json.dumps(payload_object), ))

async def handle_login(request):
    try:
        username, password = request.headers.get('Authorization').split(':')
    except:
        # We expect the Authorization header content to be "username:password",
        # so if it isn't, we return an error. This shouldn't happen.
        raise aiohttp_web.HTTPBadRequest()
    
    # Firstly fetch the Argon2 password digest from the database
    with (await request.app['db_conn_pool'].cursor()) as cursor:
        await cursor.execute(
            'SELECT id, password_hash FROM users WHERE username=%s',
            (username, )
        )
        data = [row async for row in cursor]
    
    if not data: # The username doesn't exist
        raise aiohttp_web.HTTPUnauthorized()

    # data must have length 1 due to username uniqueness
    userid, password_hash = data[0]

    try:
        if not argon2.verify(password, password_hash):
            raise aiohttp_web.HTTPUnauthorized() # Wrong password
    except:
        # TODO: log
        raise aiohttp_web.HTTPUnauthorized() # Malformed password_hash in db

    # Password is correct, generate token (bytes)
    token = jwt.encode({'userid': userid}, JWT_SECRET, algorithm='HS256')

    return aiohttp_web.Response(
        body=json.dumps({'userid': userid, 'token': token.decode('utf-8')})
    )

def userid_from_token(token):
    '''
    Gets the userid from the JWT or returns None if invalid.
    '''
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])['userid']
    except:
        return None

async def handle_client(request):
    ws = aiohttp_web.WebSocketResponse()
    await ws.prepare(request)

    userid = userid_from_token(request.rel_url.query.get('access_token'))
    await handle_connect(request.app, ws, userid)

    try:
        async for msg in ws:
            # TODO: log
            if msg.type == aiohttp.WSMsgType.TEXT:
                if msg.data == 'logout':
                    await ws.close()
                else:
                    try:
                        data = json.loads(msg.data)
                    except:
                        continue # TODO: log

                    if data['type'] == 'new_message':
                        asyncio.ensure_future(handle_new_message(request.app, data['chatid'], userid, data['message']))
                    elif data['type'] == 'start_chat':
                        asyncio.ensure_future(handle_start_chat(request.app, ws, data['userids']))
                    elif data['type'] == 'leave_chat':
                        asyncio.ensure_future(handle_leave_chat(request.app, ws, userid, data['chatid']))
                    elif data['type'] == 'get_user_suggestions':
                        asyncio.ensure_future(handle_get_user_suggestions(request.app, ws, userid, data['searchString']))
                    else:
                        pass # TODO: log

            elif msg.type == aiohttp.WSMsgType.ERROR:
                pass # TODO: log
    except Exception as e:
        pass # TODO: log
    finally:
        await handle_disconnect(request.app, ws, userid)

    return ws

async def handle_connect(app, ws, userid):
    app['all_websockets'].append(ws)

    with (await app['db_conn_pool'].cursor()) as cursor:
        await cursor.execute(
            'UPDATE users SET connected = connected + 1 WHERE id=%s',
            (userid, )
        )

        # Now check all chats the user is part of
        await cursor.execute('SELECT chatid FROM inchat WHERE userid=%s', (userid, ))
        chatids = tuple([row[0] async for row in cursor]) # Why can't I use a tuple directly?

        chat_data = await data.get_chat_data(cursor, chatids)

        user_data = await data.get_user_data(
            cursor, 
            tuple(set(sum((chat['users'] for chat in chat_data), [])))
        )

        app['userid_to_websockets'][userid].add(ws)

        await ws.send_json({'type': 'data_update', 'chat_data': chat_data, 'user_data': user_data})
        await notify(cursor, {'type': 'user_connected', 'userid': userid})

async def handle_start_chat(app, ws, userids):
    with (await app['db_conn_pool'].cursor()) as cursor:
        await cursor.execute('INSERT INTO chats (name) VALUES (null) RETURNING id')
        chatid = [row[0] async for row in cursor][0]

        print('Creating new chat with id: %r' % chatid)

        # TODO: combine into single query if possible
        for userid in userids:
            await cursor.execute(
                'INSERT INTO inchat (userid, chatid) VALUES (%s, %s)',
                (userid, chatid)
            )
        await notify(cursor, {'type': 'users_joined_chat', 'userids': userids, 'chatid': chatid})

async def handle_leave_chat(app, ws, userid, chatid):
    with (await app['db_conn_pool'].cursor()) as cursor:
        await cursor.execute(
            'DELETE FROM inchat WHERE userid=%s AND chatid=%s',
            (userid, chatid)
        )
        await notify(cursor, {'type': 'user_left_chat', 'userid': userid, 'chatid': chatid})

async def handle_disconnect(app, ws, userid):
    with (await app['db_conn_pool'].cursor()) as cursor:
        await cursor.execute(
            'UPDATE users SET connected = connected - 1 WHERE id=%s',
            (userid, )
        )

        await notify(cursor, {'type': 'user_disconnected', 'userid': userid})

    app['userid_to_websockets'][userid].remove(ws)
    app['all_websockets'].remove(ws)

async def handle_new_message(app, chatid, userid, message):
    with (await app['db_conn_pool'].cursor()) as cursor:
        now = datetime.datetime.now(pytz.utc)

        # Insert the message into the database table
        await cursor.execute('''
            INSERT INTO messages (chatid, write_time, userid, text) 
            VALUES (%s, %s, %s, %s)''', 
            (chatid, now, userid, message)
        )
        # Notify all listeners (including this process)
        # that a new message has been inserted
        notify_payload = {
            'type': 'new_message',
            'chatid': chatid, 
            'userid': userid,
            'write_time': now.isoformat(), 
            'text': message
        }
        await notify(cursor, notify_payload)

async def handle_get_user_suggestions(app, ws, userid, searchString):
    with (await app['db_conn_pool'].cursor()) as cursor:
        await cursor.execute(
            '''
            SELECT id, username, realname, connected FROM users 
            WHERE username LIKE %s AND id != %s
            ORDER BY username ASC''',
            ('%%%s%%' % searchString, userid)
        )
        data = [
            {'userid': row[0], 'username': row[1], 'realname': row[2], 'connected': row[3]}
            async for row in cursor
        ]

    await ws.send_json({'type': 'user_suggestions', 'data': data})

async def start_background_tasks(app):
    app['listener'] = app.loop.create_task(listener.listen(app))

async def cleanup_background_tasks(app):
    app['listener'].cancel()
    await app['listener']

    app['db_conn_pool'].close()
    await app['db_conn_pool'].wait_closed()

    # This will prompt the handle_client functions to exit gracefully
    await asyncio.gather(*[ws.close() for ws in app['all_websockets']])

    # At the end of handle_disconnect, each socket is removed from the list;
    # we can only proceed once all sockets have been cleaned up (and removed).
    while app['all_websockets']:
        await asyncio.sleep(0)

# TODO: Remove, see note in make_app
async def fix_users(app):
    with (await app['db_conn_pool'].cursor()) as cursor:
        await cursor.execute(
            'UPDATE users SET password_hash=%s WHERE username=%s',
            (argon2.hash('password0'), 'user0')
        )
        await cursor.execute(
            'UPDATE users SET password_hash=%s WHERE username=%s',
            (argon2.hash('password1'), 'user1')
        )

async def get_chatid_to_userids(app):
    result = defaultdict(set)
    with (await app['db_conn_pool'].cursor()) as cursor:
        await cursor.execute('SELECT chatid, userid FROM inchat')
        async for row in cursor:
            result[row[0]].add(row[1])
    return result

def make_app():
    app = aiohttp_web.Application()

    # Because we use the DB asynchronously, we may need multiple
    # concurrent cursors, so create a connection pool.
    app['db_conn_pool'] = asyncio.get_event_loop().run_until_complete(
        asyncio.ensure_future(aiopg.create_pool(common.DB_CONN_STRING))
    )
    app['chatid_to_userids'] = asyncio.get_event_loop().run_until_complete(
        asyncio.ensure_future(get_chatid_to_userids(app))
    )
    app['all_websockets'] = []
    app['userid_to_websockets'] = defaultdict(set)

    # TODO: Remove this once registration is implemented;
    # this is only here because for some reason the password_hash field doesn't set
    # properly in rebuild_db.sh, possibly because it needs escaping
    asyncio.get_event_loop().run_until_complete(asyncio.ensure_future(fix_users(app)))

    # All aiohttp_jinja2 decorators will look in the given folder
    # when searching for html files
    aiohttp_jinja2.setup(app, loader=jinja2.FileSystemLoader('../client'))
    
    # All references to app.router.static in html templates
    # will point to the given directory.
    app.router.add_static('/static', '../client', name='static', append_version=True)
    
    # All GETs, POSTs, etc go here
    app.router.add_get('/', handle_root)
    app.router.add_get('/client', handle_client)
    app.router.add_post('/login', handle_login)

    app.on_startup.append(start_background_tasks)
    app.on_cleanup.append(cleanup_background_tasks)

    return app

def main():
    aiohttp_web.run_app(make_app())

if __name__ == '__main__':
    main()
