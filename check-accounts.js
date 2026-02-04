
const Database = require('better-sqlite3');
const db = new Database('data.db');
try {
    const accounts = db.prepare("SELECT * FROM email_accounts").all();
    console.log('--- Email Accounts ---');
    accounts.forEach(acc => {
        console.log(`ID: ${acc.id}, Email: ${acc.email}`);
        console.log(`IMAP Config: ${acc.imapConfig}`);
    });
} catch (e) {
    console.log('Error:', e.message);
} finally {
    db.close();
}
