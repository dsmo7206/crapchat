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
    CREATE TABLE users (
        id serial PRIMARY KEY, 
        username varchar NOT NULL UNIQUE,
        realname varchar NOT NULL,
        password_hash varchar NOT NULL,
        connected int4 NOT NULL
    );
    CREATE TABLE chats (id serial PRIMARY KEY, name varchar);
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
    INSERT INTO users (id, username, realname, password_hash, connected) VALUES (
        0, 
        'user0', 
        'Firsty McFirstface', 
        '',
        0
    );
    INSERT INTO users (id, username, realname, password_hash, connected) VALUES (
        1, 
        'user1', 
        'Second McTwoface', 
        '',
        0
    );
    INSERT INTO chats (name) VALUES ('First chat');
    INSERT INTO chats (name) VALUES ('Second chat');
    INSERT INTO chats (name) VALUES ('A later chat');

    COMMIT;
EOF

# Note: the password above is 'hello'

echo "Finished"
