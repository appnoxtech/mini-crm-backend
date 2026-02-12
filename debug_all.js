
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function main() {
    const users = await prisma.user.findMany();
    const accounts = await prisma.emailAccount.findMany();

    let output = '--- ALL USERS ---\n';
    users.forEach(u => output += `${u.id}: ${u.name} (${u.email})\n`);

    output += '\n--- ALL ACCOUNTS ---\n';
    accounts.forEach(a => output += `User ${a.userId} | ${a.email} | ${a.provider} | ID: ${a.id}\n`);

    fs.writeFileSync('all_debug_data.txt', output);
}

main().catch(console.error).finally(() => prisma.$disconnect());
