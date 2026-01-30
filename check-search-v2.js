const Database = require('better-sqlite3');
const db = new Database('data.db');

console.log('--- ALL USERS ---');
const allUsers = db.prepare("SELECT id, name, email FROM users").all();
allUsers.forEach(u => console.log(JSON.stringify(u)));

console.log('--- PERSONS STARTING WITH A/a ---');
const somePersons = db.prepare("SELECT id, firstName, lastName, emails FROM persons WHERE firstName LIKE 'a%' OR firstName LIKE 'A%'").all();
somePersons.forEach(p => console.log(JSON.stringify(p)));

db.close();
