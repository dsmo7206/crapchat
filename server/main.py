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

from aiohttp import web as aiohttp_web
from collections import defaultdict

APP_NAME = 'Crapchat!'
DB_CONN_STRING = 'dbname=crapchat'

@aiohttp_jinja2.template('index.html')
def handle_root(request):
    return {'page_title': APP_NAME}

async def handle_new_chat(request):
    ws = aiohttp_web.WebSocketResponse()

    request.app['all_websockets'].append(ws)

    await ws.prepare(request)
    async for msg in ws:
        if msg.type == aiohttp.WSMsgType.TEXT:
            if msg.data == 'close':
                await ws.close()
            else:
                try:
                    data = json.loads(msg.data)
                except:
                    print('Problem parsing JSON')
                    continue

                chatid = data['chatid']

                if data['type'] == 'refresh':
                    # This could take time and we don't want to hold up the current
                    # function, so call ensure_future - and we don't need the
                    # returned Task/Future object.
                    request.app['chatid_to_websockets'][chatid].add(ws)
                    asyncio.ensure_future(handle_refresh(request.app, ws, chatid))
                elif data['type'] == 'new_message':
                    asyncio.ensure_future(handle_new_message(request.app, chatid, data['message']))
                else:
                    print('Invalid data: %s' % data)

        elif msg.type == aiohttp.WSMsgType.ERROR:
            print('ws closed with exception %s' % ws.exception())
    print('ws closed')

    for websocket_set in request.app['chatid_to_websockets'].values():
        try:
            websocket_set.remove(ws)
        except KeyError:
            pass
    request.app['all_websockets'].remove(ws)

    return ws

async def handle_refresh(app, ws, chatid):
    with (await app['db_conn_pool'].cursor()) as cursor:
        await cursor.execute(
            'SELECT user_name, write_time, text FROM messages WHERE chatid=%s', 
            (chatid, )
        )
        messages = [
            {'user': row[0], 'time': str(row[1]), 'text': row[2]}
            async for row in cursor
        ]

    await ws.send_json({'type': 'refresh', 'chatid': chatid, 'data': messages})

def datetimeToJavascriptString(dt):
    return str(dt) # TODO

async def handle_new_message(app, chatid, message):
    print('Called handle_new_message(chatid=%s, message=%s)' % (chatid, message))

    with (await app['db_conn_pool'].cursor()) as cursor:
        now = datetime.datetime.now(pytz.utc)

        # Insert the message into the database table
        await cursor.execute('''
            INSERT INTO messages (chatid, write_time, user_name, text) 
            VALUES (%s, %s, %s, %s)''', 
            (chatid, now, message['user'], message['text'])
        )
        # Notify all listeners (including this process)
        # that a new message has been inserted
        notify_payload = {
            'chatid': chatid, 
            'user': message['user'],
            'time': datetimeToJavascriptString(now), 
            'text': message['text']
        }
        await cursor.execute('NOTIFY new_message, %s', (json.dumps(notify_payload), ))

async def db_listen(app):
    try:
        conn = await aiopg.connect(DB_CONN_STRING)
        async with conn.cursor() as cursor:
            await cursor.execute('LISTEN new_message')
            while True:
                msg = await conn.notifies.get()
                if msg.payload == 'finish':
                    return
                else:
                    payload = json.loads(msg.payload)
                    print('Notification received: %s' % msg.payload)
                    chatid = payload['chatid']

                    new_message_object = {
                        'type': 'new_message', 
                        'chatid': chatid, 
                        'data': {
                            'user': payload['user'],
                            'time': payload['time'],
                            'text': payload['text']
                        }
                    }

                    for ws in app['chatid_to_websockets'][chatid]:
                        await ws.send_json(new_message_object)

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
    app.router.add_get('/chat', handle_new_chat)

    app.on_startup.append(start_background_tasks)
    app.on_cleanup.append(cleanup_background_tasks)

    return app

def main():
    aiohttp_web.run_app(make_app())

if __name__ == '__main__':
    main()
