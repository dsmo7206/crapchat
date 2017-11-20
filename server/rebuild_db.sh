#!/bin/bash

# Don't need "sudo -i -u postgres" but current user's username
# needs to have been added as a role, and made superuser.

DBNAME="crapchat"

echo "Dropping db $DBNAME (if it exists)"
dropdb $DBNAME

echo "Creating new db $DBNAME"
createdb $DBNAME

echo "Adding tables"
psql crapchat << EOF
    BEGIN TRANSACTION;
    CREATE TABLE users (id serial PRIMARY KEY, name varchar NOT NULL, connected int4 NOT NULL);
    CREATE TABLE chats (id serial PRIMARY KEY, name varchar NOT NULL);
    CREATE TABLE inchat (
    	id serial PRIMARY KEY,
    	chatid int4 REFERENCES chats (id), 
    	userid int4 REFERENCES users (id)
    );
    CREATE TABLE messages (
    	id serial PRIMARY KEY, 
    	chatid int4 REFERENCES chats (id), 
    	userid int4 REFERENCES users (id),
    	write_time timestamptz NOT NULL,  
    	text varchar
    );
    INSERT INTO users (id, name, connected) VALUES (0, 'David Smoker', 0);
    INSERT INTO chats (id, name) VALUES (0, 'First chat');
    INSERT INTO chats (id, name) VALUES (1, 'Second chat');
    INSERT INTO chats (id, name) VALUES (123, 'A later chat');
    INSERT INTO inchat (id, chatid, userid) VALUES (0, 123, 0);
    INSERT INTO messages (id, chatid, userid, write_time, text) VALUES (0, 0, 0, now(), 'test message');

    COMMIT;
EOF

echo "Finished"
