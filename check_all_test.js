const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const emails = await prisma.email.findMany({
            where: { subject: { contains: 'test', mode: 'insensitive' } }
        });

        console.log(`Found ${emails.length} test emails.`);
        for (const e of emails) {
            console.log(`[${e.isIncoming ? 'IN' : 'OUT'}] Subj: ${e.subject}, DealIds: ${JSON.stringify(e.dealIds)}, Thread: ${e.threadId}`);
        }

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
