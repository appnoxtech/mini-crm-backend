
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
    const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true }
    });
    const accounts = await prisma.emailAccount.findMany({
        select: { id: true, userId: true, email: true, provider: true }
    });

    let output = '--- USERS ---\n';
    users.forEach(u => output += `${u.id}: ${u.name} (${u.email})\n`);

    output += '\n--- ACCOUNTS ---\n';
    accounts.forEach(a => output += `User ${a.userId} | ${a.email} | ${a.provider} | ID: ${a.id}\n`);

    fs.writeFileSync('accounts_listing.txt', output);
    console.log('Output written to accounts_listing.txt');
}

main().catch(console.error).finally(() => prisma.$disconnect());
