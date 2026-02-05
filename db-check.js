
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const accounts = await prisma.emailAccount.findMany({
        select: {
            id: true,
            email: true,
            isActive: true,
            userId: true
        }
    });
    console.log(JSON.stringify(accounts, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
