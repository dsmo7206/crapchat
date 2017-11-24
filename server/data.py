async def get_chat_data(cursor, chatids):
    '''
    Returns a list of dicts, where each dict contains:
        chatid: The chat id
        name: The chat name
        messages: A list of dicts with keys ('userid', 'write_time', 'text')
    '''
    if not chatids:
        return [] # The query directly below will fail on an empty tuple

    # Get chat names
    await cursor.execute('SELECT id, name FROM chats WHERE id IN %s', (chatids, ))
    chat_data = {
        row[0]: {'name': row[1], 'users': [], 'messages': []} 
        async for row in cursor
    }

    # Get users in each chat
    await cursor.execute(
        'SELECT chatid, userid FROM inchat WHERE chatid IN %s',
        (tuple(chat_data.keys()), )
    )
    async for row in cursor:
        chat_data[row[0]]['users'].append(row[1])

    # Get chat messages
    await cursor.execute(
        'SELECT chatid, userid, write_time, text FROM messages WHERE chatid IN %s',
        (tuple(chat_data.keys()), )
    )
    async for row in cursor:
        chat_data[row[0]]['messages'].append({'userid': row[1], 'write_time': row[2].isoformat(), 'text': row[3]})

    # To ease reading the data on the client side, we will convert the Python dict
    # into a list and move the chatid (the key) into each value.
    return [
        {'chatid': chatid, **value}
        for chatid, value in chat_data.items()
    ]

async def get_user_data(cursor, userids):
    if not userids:
        return [] # The query directly below will fail on an empty tuple

    await cursor.execute(
        'SELECT id, username, realname, connected FROM users WHERE id IN %s',
        (userids, )
    )
    return [
        {'userid': row[0], 'username': row[1], 'realname': row[2], 'connected': row[3]}
        async for row in cursor
    ]