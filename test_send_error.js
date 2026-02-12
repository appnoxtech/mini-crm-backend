const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    try {
        const userId = "1";
        // Simulate what the controller does
        const emailAccount = await prisma.emailAccount.findFirst({
            where: { userId: parseInt(userId), isActive: true }
        });

        if (!emailAccount) {
            console.log("No account found");
            return;
        }

        console.log("Using account:", emailAccount.email);

        // This would be the emailService.sendEmail call
        // Let's see if we can trigger a Prisma error during activity creation
        const dealId = 5;

        // Simulate activity creation which I suspect is the culprit
        const activityData = {
            dealId: dealId,
            userId: parseInt(userId),
            activityType: 'mail',
            subject: 'Test Subject',
            label: 'outgoing',
            priority: 'none',
            busyFree: 'free',
            email: {
                from: emailAccount.email,
                to: ["test@example.com"],
                subject: 'Test Subject',
                body: 'Test Body',
                threadId: 'test-thread-id',
                attachments: [] // Empty array
            },
            organization: "test@example.com",
            participants: [],
            persons: [],
            isDone: true,
            completedAt: new Date()
        };

        console.log("Attempting to create activity...");
        const activity = await prisma.dealActivity.create({
            data: activityData
        });
        console.log("Activity created successfully:", activity.id);

    } catch (error) {
        console.error("TEST FAILED WITH ERROR:");
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

test();
