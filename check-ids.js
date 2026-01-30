const Database = require('better-sqlite3');
const db = new Database('data.db');

console.log('--- ALL USERS ---');
const users = db.prepare("SELECT id, name FROM users").all();
console.log(JSON.stringify(users, null, 2));

console.log('\n--- ALL PERSONS ---');
const persons = db.prepare("SELECT id, firstName, lastName FROM persons").all();
console.log(JSON.stringify(persons, null, 2));

db.close();
