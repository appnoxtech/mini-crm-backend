const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const email = await prisma.email.findFirst();
        console.log("Email table is accessible.");
        const columns = Object.keys(await prisma.email.findFirst() || {});
        console.log("Found columns or table empty.");

        // Check specific new field
        await prisma.deal.findFirst({
            select: { emailSyncStatus: true }
        });
        console.log("Deal.emailSyncStatus is accessible.");
    } catch (err) {
        console.error("Verification failed:", err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
