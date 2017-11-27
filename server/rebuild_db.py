#!/usr/bin/env python3

# Don't need "sudo -i -u postgres" but current user's username
# needs to have been added as a role, and made superuser.

import os
import psycopg2
import random

import common
from passlib.hash import argon2

DBNAME = 'crapchat'

print("Dropping db %s (if it exists)" % DBNAME)
os.system('dropdb %s' % DBNAME)

print('Creating new db %s' % DBNAME)
os.system('createdb %s' % DBNAME)

print('Adding data...')
conn = psycopg2.connect(common.DB_CONN_STRING)
cursor = conn.cursor()

cursor.execute('''
CREATE TABLE users (
    id serial PRIMARY KEY, 
    username varchar NOT NULL UNIQUE,
    realname varchar NOT NULL,
    password_hash varchar NOT NULL,
    connected int4 NOT NULL
)
''')

cursor.execute('''
CREATE TABLE chats (id serial PRIMARY KEY, name varchar)
''')

cursor.execute('''
CREATE TABLE inchat (
    id serial PRIMARY KEY,
    chatid int4 REFERENCES chats (id), 
    userid int4 REFERENCES users (id)
)
''')

cursor.execute('''
CREATE TABLE messages (
    id serial PRIMARY KEY, 
    chatid int4 REFERENCES chats (id), 
    userid int4 REFERENCES users (id),
    write_time timestamptz NOT NULL,  
    text varchar
)
''')

FIRST_NAMES = ['David', 'Abdul', 'Jin', 'Spencer', 'Pierre', 'Zoltan', 'Jennifer', 'Fatima', 'Ling', 'Georgina', 'Federica', 'Olga']
LAST_NAMES = ['Smith', 'Garcia', 'Wang', 'Hussein', 'Somers', 'Wilson', 'Svensson']

used_names = set()
def get_random_name():
    while True:
        name = '%s %s' % (random.choice(FIRST_NAMES), random.choice(LAST_NAMES))
        if name not in used_names:
            used_names.add(name)
            return name

# Create 9 example users
for i in range(1, 10):
    cursor.execute('''
    INSERT INTO users 
        (username, realname, password_hash, connected) 
        VALUES (%s, %s, %s, %s)
    ''', (
        'user%s' % i,
        get_random_name(),
        argon2.hash('p%s' % i),
        0
    ))

conn.commit()
print('Done!')
