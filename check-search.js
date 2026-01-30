const Database = require('better-sqlite3');
const db = new Database('data.db');

console.log('--- ALL USERS ---');
const allUsers = db.prepare("SELECT id, name, email FROM users").all();
console.log(JSON.stringify(allUsers, null, 2));

console.log('--- ALL PERSONS ---');
const allPersons = db.prepare("SELECT id, firstName, lastName, emails FROM persons").all();
console.log(JSON.stringify(allPersons, null, 2));

db.close();
