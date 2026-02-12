const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const test = await prisma.email.findFirst({
            where: { subject: 'test', isIncoming: false }
        });

        if (test) {
            console.log('TEST_START');
            console.log('Subject:', test.subject);
            console.log('DealIds:', JSON.stringify(test.dealIds));
            console.log('ThreadId:', test.threadId);
            console.log('MessageId:', test.messageId);
            console.log('TEST_END');
        } else {
            console.log('Original "test" email not found');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
