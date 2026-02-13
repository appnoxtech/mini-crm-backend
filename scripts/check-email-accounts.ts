/**
 * Script to check email accounts and their companyId status
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEmailAccounts() {
    console.log('🔍 Checking all email accounts...\n');

    const accounts = await prisma.emailAccount.findMany({
        include: {
            user: {
                select: {
                    id: true,
                    companyId: true,
                    email: true
                }
            }
        }
    });

    console.log(`Total email accounts: ${accounts.length}\n`);

    let accountsWithCompanyId = 0;
    let accountsMissingCompanyId = 0;

    for (const account of accounts) {
        if (account.companyId) {
            accountsWithCompanyId++;
        } else {
            accountsMissingCompanyId++;
            console.log(`⚠️  Account ${account.id} (${account.email}):`);
            console.log(`   User ID: ${account.userId}`);
            console.log(`   User companyId: ${account.user?.companyId || 'N/A'}`);
            console.log(`   Account companyId: ${account.companyId || 'NULL'}\n`);
        }
    }

    console.log('📊 Summary:');
    console.log(`   Accounts with companyId: ${accountsWithCompanyId}`);
    console.log(`   Accounts missing companyId: ${accountsMissingCompanyId}`);
}

checkEmailAccounts()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
