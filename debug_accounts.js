
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true }
    });
    const accounts = await prisma.emailAccount.findMany({
        select: { id: true, userId: true, email: true, provider: true }
    });

    console.log('--- USERS ---');
    users.forEach(u => console.log(`${u.id}: ${u.name} (${u.email})`));

    console.log('\n--- ACCOUNTS ---');
    accounts.forEach(a => console.log(`User ${a.userId} | ${a.email} | ${a.provider} | ID: ${a.id}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
