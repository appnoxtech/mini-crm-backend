const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const query = 'govind';
        const allEmails = await prisma.email.findMany();

        const matches = allEmails.filter(e => {
            return JSON.stringify(e).toLowerCase().includes(query.toLowerCase());
        });

        console.log(`Found ${matches.length} emails containing "${query}"`);
        matches.forEach(e => {
            console.log(`- ID: ${e.id}, Subject: ${e.subject}, From: ${e.from}, To: ${JSON.stringify(e.to)}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
