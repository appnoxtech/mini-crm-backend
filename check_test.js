const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const emails = await prisma.email.findMany({
            where: { subject: { contains: 'test', mode: 'insensitive' } }
        });

        console.log('--- EMAILS ---');
        for (const e of emails) {
            console.log(`- Subj: ${e.subject}`);
            console.log(`  ID: ${e.id}`);
            console.log(`  Thread: ${e.threadId}`);
            console.log(`  Deals: ${JSON.stringify(e.dealIds)}`);
            console.log(`  Incoming: ${e.isIncoming}`);
        }

        const activities = await prisma.dealActivity.findMany({
            where: { activityType: 'mail' }
        });

        console.log('\n--- ACTIVITIES ---');
        for (const a of activities) {
            console.log(`- ID: ${a.id}, Deal: ${a.dealId}, Subject: ${a.subject}`);
            console.log(`  Thread in Activity: ${a.email?.threadId}`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
