const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const deals = await prisma.deal.findMany({
            include: {
                person: {
                    include: { userEmails: true }
                }
            }
        });

        console.log(`--- DEALS (${deals.length}) ---`);
        deals.forEach(d => {
            console.log(`Deal: ${d.title} (ID: ${d.id})`);
            if (d.person) {
                console.log(`  Person: ${d.person.firstName} ${d.person.lastName} (ID: ${d.person.id})`);
                const emails = d.person.userEmails.map(e => e.email);
                console.log(`  Emails (UserEmails): ${JSON.stringify(emails)}`);
                console.log(`  Emails (JSON): ${JSON.stringify(d.person.emails)}`);
            } else {
                console.log('  No Person associated');
            }
        });

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
