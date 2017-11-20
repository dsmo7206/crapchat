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
import pytz
import sys

from aiohttp import web as aiohttp_web
from collections import defaultdict

APP_NAME = 'Crapchat!'
DB_CONN_STRING = 'dbname=crapchat'

@aiohttp_jinja2.template('index.html')
def handle_root(request):
    return {'page_title': APP_NAME}

async def notify(cursor, payload_object):
    await cursor.execute('NOTIFY channel, %s', (json.dumps(payload_object), ))

async def handle_client(request):
    ws = aiohttp_web.WebSocketResponse()

    userid = request.match_info.get('userid', 0) # TODO get userid from auth
    asyncio.ensure_future(handle_connect(request.app, ws, userid))

    await ws.prepare(request)
    async for msg in ws:
        # TODO: log
        print('Got message %s' % repr(msg))
        if msg.type == aiohttp.WSMsgType.TEXT:
            if msg.data == 'close':
                await ws.close()
            else:
                try:
                    data = json.loads(msg.data)
                except:
                    continue # TODO: log

                if data['type'] == 'join_chat':
                    asyncio.ensure_future(handle_join_chat(request.app, ws, userid, data['chatid']))
                elif data['type'] == 'leave_chat':
                    asyncio.ensure_future(handle_leave_chat(request.app, ws, userid, data['chatid']))
                elif data['type'] == 'new_message':
                    asyncio.ensure_future(handle_new_message(request.app, data['chatid'], userid, data['message']))
                elif data['type'] == 'get_chat_suggestions':
                    asyncio.ensure_future(handle_get_chat_suggestions(request.app, ws, data['searchString']))
                else:
                    pass # TODO: log

        elif msg.type == aiohttp.WSMsgType.ERROR:
            pass # TODO: log
            
    asyncio.ensure_future(handle_disconnect(request.app, ws, userid))

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

        chat_data = await get_chat_data(cursor, chatids)

        for chatid in chatids:
            app['chatid_to_websockets'][chatid].add(ws)

        await ws.send_json({'type': 'refresh', 'chat_data': chat_data})
        await notify(cursor, {'type': 'user_connected', 'userid': userid})

async def handle_join_chat(app, ws, userid, chatid):
    app['chatid_to_websockets'][chatid].add(ws)

    with (await app['db_conn_pool'].cursor()) as cursor:
        await cursor.execute(
            'INSERT INTO inchat (userid, chatid) VALUES (%s, %s)',
            (userid, chatid)
        )

        # Get data for this chat alone
        chat_data = await get_chat_data(cursor, (chatid, ))
        app['chatid_to_websockets'][chatid].add(ws)

        # Send partial refresh to user
        await ws.send_json({'type': 'refresh', 'chat_data': chat_data})

        await notify(cursor, {'type': 'user_joined_chat', 'userid': userid, 'chatid': chatid})

async def get_chat_data(cursor, chatids):
    # Get chat names
    await cursor.execute('SELECT id, name FROM chats WHERE id IN %s', (chatids, ))
    chat_data = {
        row[0]: {'name': row[1], 'messages': []} 
        async for row in cursor
    }

    # Get chat messages
    await cursor.execute(
        'SELECT chatid, userid, write_time, text FROM messages WHERE chatid IN %s',
        (tuple(chat_data.keys()), )
    )
    async for row in cursor:
        chat_data[row[0]]['messages'].append({'user': row[1], 'write_time': row[2].isoformat(), 'text': row[3]})

    # To ease reading the data on the client side, we will convert the Python dict
    # into a list and move the chatid (the key) into each value.
    return [
        {'chatid': chatid, **value}
        for chatid, value in chat_data.items()
    ]

async def handle_leave_chat(app, ws, userid, chatid):
    with (await app['db_conn_pool'].cursor()) as cursor:
        await cursor.execute(
            'DELETE FROM inchat WHERE userid=%s AND chatid=%s',
            (userid, chatid)
        )
        await notify(cursor, {'type': 'user_left_chat', 'userid': userid, 'chatid': chatid})

    app['chatid_to_websockets'][chatid].remove(ws)

async def handle_disconnect(app, ws, userid):
    with (await app['db_conn_pool'].cursor()) as cursor:
        await cursor.execute(
            'UPDATE users SET connected = connected - 1 WHERE id=%s',
            (userid, )
        )

        await notify(cursor, {'type': 'user_disconnected', 'userid': userid})

    for chatid, websocket_set in app['chatid_to_websockets'].items():
        try:
            websocket_set.remove(ws)
        except KeyError:
            pass # Expected when websocket isn't listening to chat

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
            'time': now.isoformat(), 
            'text': message
        }
        await notify(cursor, notify_payload)

async def handle_get_chat_suggestions(app, ws, searchString):
    with (await app['db_conn_pool'].cursor()) as cursor:
        await cursor.execute(
            'SELECT id, name FROM chats WHERE name LIKE %s',
            ('%%%s%%' % searchString, )
        )
        data = [
            {'chatid': row[0], 'name': row[1]}
            async for row in cursor
        ]

    await ws.send_json({'type': 'chat_suggestions', 'data': data})

async def db_listen(app):
    try:
        conn = await aiopg.connect(DB_CONN_STRING)
        async with conn.cursor() as cursor:
            await cursor.execute('LISTEN channel')
            while True:
                msg = await conn.notifies.get()
                payload = json.loads(msg.payload)

                print('GOT NOTIFY: %s' % repr(payload))

                if payload['type'] == 'new_message':
                    chatid = payload['chatid']

                    # TODO: log
                    new_message_object = {
                        'type': 'new_message', 
                        'chatid': chatid, 
                        'data': {
                            'userid': payload['userid'],
                            'time': payload['time'],
                            'text': payload['text']
                        }
                    }

                    for ws in app['chatid_to_websockets'][chatid]:
                        asyncio.ensure_future(ws.send_json(new_message_object))

                elif payload['type'] == 'user_connected':
                    pass
                elif payload['type'] == 'user_disconnected':
                    pass
                elif payload['type'] == 'user_joined_chat':
                    pass
                elif payload['type'] == 'user_left_chat':
                    pass
                else:
                    pass # TODO: log

    except asyncio.CancelledError:
        pass

async def start_background_tasks(app):
    app['db_listener'] = app.loop.create_task(db_listen(app))

async def cleanup_background_tasks(app):
    app['db_listener'].cancel()
    await app['db_listener']

def make_app():
    app = aiohttp_web.Application()

    # Because we use the DB asynchronously, we may need multiple
    # concurrent cursors, so create a connection pool.
    app['db_conn_pool'] = asyncio.get_event_loop().run_until_complete(
        asyncio.ensure_future(
            aiopg.create_pool(DB_CONN_STRING)
        )
    )
    app['all_websockets'] = []
    app['chatid_to_websockets'] = defaultdict(set)

    # All aiohttp_jinja2 decorators will look in the given folder
    # when searching for html files
    aiohttp_jinja2.setup(app, loader=jinja2.FileSystemLoader('../client'))
    
    # All references to app.router.static in html templates
    # will point to the given directory.
    app.router.add_static('/static', '../client', name='static', append_version=True)
    
    # All GETs, POSTs, etc go here
    app.router.add_get('/', handle_root)
    app.router.add_get('/client/{userid}', handle_client) # TODO: change to auth

    app.on_startup.append(start_background_tasks)
    app.on_cleanup.append(cleanup_background_tasks)

    return app

def main():
    aiohttp_web.run_app(make_app())

if __name__ == '__main__':
    main()
