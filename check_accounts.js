
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const accounts = await prisma.emailAccount.findMany({
        select: {
            id: true,
            userId: true,
            email: true,
            provider: true,
            isActive: true
        }
    });
    console.log(JSON.stringify(accounts, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
