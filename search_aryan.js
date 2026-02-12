const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const query = 'aryan';
        const allEmails = await prisma.email.findMany();

        const matches = allEmails.filter(e => {
            return JSON.stringify(e).toLowerCase().includes(query.toLowerCase());
        });

        console.log(`Found ${matches.length} emails\n`);
        matches.forEach(e => {
            console.log(`ID: ${e.id}`);
            console.log(`SUB: ${e.subject}`);
            console.log(`FROM: ${e.from}`);
            console.log(`TO: ${JSON.stringify(e.to)}`);
            console.log('---');
        });

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
