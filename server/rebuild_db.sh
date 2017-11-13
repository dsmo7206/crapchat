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
    CREATE TABLE messages (id serial PRIMARY KEY, chatid integer, write_time timestamptz, user_name varchar, text varchar);
    COMMIT;
EOF

echo "Finished"
