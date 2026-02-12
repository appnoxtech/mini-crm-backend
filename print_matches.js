const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const query = 'govind';
        const allEmails = await prisma.email.findMany();

        const matches = allEmails.filter(e => {
            return JSON.stringify(e).toLowerCase().includes(query.toLowerCase());
        });

        console.log(`Found ${matches.length} emails\n`);
        matches.forEach(e => {
            console.log(`SUBJECT: ${e.subject}`);
            console.log(`  FROM: ${e.from}`);
            console.log(`    TO: ${JSON.stringify(e.to)}`);
            console.log(`DEALS: ${JSON.stringify(e.dealIds)}`);
            console.log(`THREAD: ${e.threadId}`);
            console.log('---');
        });

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
