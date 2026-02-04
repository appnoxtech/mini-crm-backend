
const Database = require('better-sqlite3');
const db = new Database('data.db');
try {
    const accounts = db.prepare("SELECT * FROM email_accounts WHERE imapConfig LIKE '%hostinger%'").all();
    accounts.forEach(acc => {
        console.log('--- ACCOUNT ---');
        console.log('Email:', acc.email);
        console.log('IMAP Config JSON:', JSON.stringify(acc.imapConfig));
        const config = JSON.parse(acc.imapConfig);
        console.log('Host literal:', `'${config.host}'`);
    });
} catch (e) {
    console.log('Error:', e.message);
} finally {
    db.close();
}
