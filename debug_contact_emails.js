const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const dealId = 1;
        const deal = await prisma.deal.findUnique({
            where: { id: dealId },
            include: {
                person: {
                    include: {
                        userEmails: true,
                    },
                },
                organization: true,
            },
        });

        console.log('DEAL:', deal.title);
        if (deal.person) {
            console.log('PERSON:', deal.person.firstName);
            console.log('USER_EMAILS:', deal.person.userEmails.map(e => e.email));
            console.log('JSON_EMAILS:', deal.person.emails);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
