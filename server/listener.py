import aiopg
import asyncio
import json

import common
import data

async def listen(app):
    try:
        conn = await aiopg.connect(common.DB_CONN_STRING)
        async with conn.cursor() as cursor:
            await cursor.execute('LISTEN channel')
            while True:
                msg = await conn.notifies.get()
                await handle_notification(app, cursor, json.loads(msg.payload))
    except asyncio.CancelledError:
        conn.close()

async def handle_notification(app, cursor, payload):
    print('listener handling notification: %r' % payload)
    # TODO: log

    if payload['type'] == 'new_message':
        chatid = payload['chatid']
        new_message_object = {
            'type': 'new_message', 
            'chatid': chatid, 
            'data': {
                'userid': payload['userid'],
                'write_time': payload['write_time'],
                'text': payload['text']
            }
        }
        # Notify each user in the chat who is currently connected
        asyncio.ensure_future(
            asyncio.gather(*(
                ws.send_json(new_message_object)
                for userid in app['chatid_to_userids'][chatid]
                for ws in app['userid_to_websockets'][userid]
            ))
        )
    
    elif payload['type'] == 'user_connected':
        pass
    
    elif payload['type'] == 'user_disconnected':
        pass
    
    elif payload['type'] == 'users_joined_chat':
        userids_set = app['chatid_to_userids'][payload['chatid']]
        for userid in payload['userids']:
            userids_set.add(userid)

        # NOTE: in theory these two calls could be parallelised with
        # asyncio.gather, but we'd need two different cursors.
        chat_data = await data.get_chat_data(cursor, (payload['chatid'], ))
        user_data = await data.get_user_data(cursor, tuple(userids_set))

        # Some users have joined the chat, so we need to send 
        # a refresh of the chat to each new user.
        update_message = {'type': 'data_update', 'chat_data': chat_data, 'user_data': user_data}

        await asyncio.gather(*(
            ws.send_json(update_message)
            for userid in payload['userids']
            for ws in app['userid_to_websockets'][userid]
        ))
        # TODO: notify the existing users of the chat about the new users

    elif payload['type'] == 'user_left_chat':
        app['chatid_to_userids'][payload['chatid']].remove(payload['userid'])
    
    else:
        pass # TODO: log
