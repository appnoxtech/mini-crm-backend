const Database = require('better-sqlite3');
const db = new Database('data.db');

const users = db.prepare("SELECT id, name FROM users").all();
console.log('USERS count:', users.length);
users.forEach(u => console.log(`USER: ${u.id} - ${u.name}`));

const persons = db.prepare("SELECT id, firstName, lastName FROM persons").all();
console.log('PERSONS count:', persons.length);
persons.forEach(p => console.log(`PERSON: ${p.id} - ${p.firstName} ${p.lastName}`));

db.close();
