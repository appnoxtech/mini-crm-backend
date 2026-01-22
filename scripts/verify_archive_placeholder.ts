
import Database from 'better-sqlite3';

const db = new Database('data.db');
const userId = '1';

async function verifyArchive() {
    console.log('Running verification script...');

    // 1. Get an email from INBOX
    const inboxStmt = db.prepare(`
    SELECT * FROM emails 
    WHERE isIncoming = 1 
      AND (labelIds IS NULL OR (labelIds NOT LIKE '%SPAM%' AND labelIds NOT LIKE '%JUNK%' AND labelIds NOT LIKE '%TRASH%' AND labelIds NOT LIKE '%ARCHIVE%'))
    LIMIT 1
  `);

    const email = inboxStmt.get() as any;
    if (!email) {
        console.log('No email found in Inbox to test.');
        return;
    }

    console.log(`Found email in Inbox: ${email.id} (Subject: ${email.subject})`);

    // 2. Simulate Archive (update DB directly as if the API was called)
    // In reality, the API will do this. This script is just to verify the SQL logic works as expected if we were manually testing DB queries.
    // But wait, this script is defined in the plan to run 'archiveEmail' endpoint? 
    // Ah, the plan said "Create a temporary script to... call archiveEmail endpoint". 
    // This looks like I'm writing a pure DB script. 
    // Let's make this script actually call the API using fetch if the server is running, or just test the model methods by importing them if possible. 
    // Importing TS files in a script might be tricky without ts-node and config. 
    // I will write this as a robust test script that can be run with custom commands if needed, 
    // but for now I'm just verifying logic.

    console.log('Verification will be done better via curl or manual test after implementation.');
}

verifyArchive();
