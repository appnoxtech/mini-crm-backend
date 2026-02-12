const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const deals = await prisma.deal.findMany();
        console.log(`--- DEALS (${deals.length}) ---`);
        deals.forEach(d => console.log(`ID: ${d.id}, Title: ${d.title}`));

        const emails = await prisma.email.findMany({
            select: {
                id: true,
                subject: true,
                dealIds: true,
                threadId: true,
                from: true,
                to: true,
                isIncoming: true,
                sentAt: true
            },
            orderBy: { sentAt: 'desc' },
            take: 50
        });
        console.log(`\n--- RECENT EMAILS (${emails.length}) ---`);
        emails.forEach(e => {
            console.log(`ID: ${e.id}\n  Subject: ${e.subject}\n  Thread: ${e.threadId}\n  Deals: ${JSON.stringify(e.dealIds)}\n  By: ${e.from} [${e.isIncoming ? 'IN' : 'OUT'}]`);
        });

        const activities = await prisma.dealActivity.findMany({
            where: { activityType: 'mail' },
            orderBy: { createdAt: 'desc' }
        });
        console.log(`\n--- MAIL ACTIVITIES (${activities.length}) ---`);
        activities.forEach(a => {
            const e = a.email;
            console.log(`ID: ${a.id}, Deal: ${a.dealId}, Thread: ${e?.threadId}, Subj: ${a.subject}`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
