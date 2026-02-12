const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const reply = await prisma.email.findFirst({
            where: { subject: { contains: 'Re: test' } }
        });

        if (reply) {
            console.log('REPLY_START');
            console.log('Subject:', reply.subject);
            console.log('DealIds:', JSON.stringify(reply.dealIds));
            console.log('ThreadId:', reply.threadId);
            console.log('REPLY_END');

            const activities = await prisma.dealActivity.findMany({
                where: { activityType: 'mail' }
            });

            const match = activities.find(a => a.email && a.email.messageId === reply.messageId);
            console.log('ACTIVITY_MATCH:', !!match);
        } else {
            console.log('Reply "Re: test" not found');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
