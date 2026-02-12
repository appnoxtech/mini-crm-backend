
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
    const emails = await prisma.email.findMany({
        where: {
            OR: [
                { subject: { contains: 'testing', mode: 'insensitive' } },
                { subject: { contains: 'ABCD', mode: 'insensitive' } }
            ]
        },
        select: {
            id: true,
            subject: true,
            from: true,
            to: true,
            threadId: true,
            dealIds: true,
            isIncoming: true,
            createdAt: true
        },
        orderBy: { createdAt: 'desc' }
    });

    fs.writeFileSync('testing_emails.json', JSON.stringify(emails, null, 2));
    console.log('Results written to testing_emails.json');
}

main().catch(console.error).finally(() => prisma.$disconnect());
