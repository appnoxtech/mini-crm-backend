const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    try {
        const query = 'govind';
        const allEmails = await prisma.email.findMany();

        const matches = allEmails.filter(e => {
            return JSON.stringify(e).toLowerCase().includes(query.toLowerCase());
        });

        let output = `Found ${matches.length} emails\n\n`;
        matches.forEach(e => {
            output += `ID: ${e.id}\n`;
            output += `SUB: ${e.subject}\n`;
            output += `FROM: ${e.from}\n`;
            output += `TO: ${JSON.stringify(e.to)}\n`;
            output += `DEAL_IDS: ${JSON.stringify(e.dealIds)}\n`;
            output += '---\n';
        });

        fs.writeFileSync('exact_emails.txt', output);
        console.log('Done.');

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
