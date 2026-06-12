db = db.getSiblingDB('wstore_db');

db.createUser({
  user: 'wstore_user',
  pwd: 'wstore_pass',
  roles: [
    {
      role: 'readWrite',
      db: 'wstore_db'
    }
  ],
  mechanisms: ['SCRAM-SHA-256']
});

print('User wstore_user created in wstore_db with SCRAM-SHA-256');
