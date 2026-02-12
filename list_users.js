const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const users = await prisma.user.findMany();
        console.log(`Users found: ${users.length}`);
        users.forEach(u => {
            console.log(`ID: ${u.id}, Name: ${u.firstName} ${u.lastName}`);
        });
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
