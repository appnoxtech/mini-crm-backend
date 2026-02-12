const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const targetEmails = ['appnox.govind@gmail.com', 'govind.sharma@appnox.ai'];
        console.log('Searching for:', targetEmails);

        const allEmails = await prisma.email.findMany({
            select: { id: true, subject: true, from: true, to: true, threadId: true }
        });

        console.log(`Checking ${allEmails.length} total emails...`);

        const matches = allEmails.filter(e => {
            const content = JSON.stringify(e).toLowerCase();
            return targetEmails.some(target => content.includes(target.toLowerCase()));
        });

        console.log(`Found ${matches.length} matching emails.`);
        matches.forEach(e => {
            console.log(`- ID: ${e.id}\n  Subj: ${e.subject}\n  From: ${e.from}\n  To: ${JSON.stringify(e.to)}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
