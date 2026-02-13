/**
 * Script to fix email accounts with missing companyId
 * 
 * This script:
 * 1. Finds all email accounts with NULL companyId
 * 2. Fetches the companyId from the associated user
 * 3. Updates the email account with the correct companyId
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMissingCompanyIds() {
    console.log('🔍 Checking for email accounts with missing companyId...');

    // Find all email accounts where companyId is NULL
    const accountsWithoutCompany = await prisma.emailAccount.findMany({
        where: {
            companyId: null as any
        },
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

    console.log(`Found ${accountsWithoutCompany.length} email accounts with missing companyId`);

    if (accountsWithoutCompany.length === 0) {
        console.log('✅ All email accounts have companyId set!');
        return;
    }

    let fixed = 0;
    let errors = 0;

    for (const account of accountsWithoutCompany) {
        try {
            if (!account.user?.companyId) {
                console.warn(`⚠️  Account ${account.id} (${account.email}): User ${account.userId} has no companyId - skipping`);
                errors++;
                continue;
            }

            await prisma.emailAccount.update({
                where: { id: account.id },
                data: { companyId: account.user.companyId }
            });

            console.log(`✅ Fixed account ${account.id} (${account.email}): Set companyId to ${account.user.companyId}`);
            fixed++;
        } catch (error: any) {
            console.error(`❌ Error fixing account ${account.id}:`, error.message);
            errors++;
        }
    }

    console.log('\n📊 Summary:');
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Errors: ${errors}`);
    console.log(`   Total: ${accountsWithoutCompany.length}`);
}

fixMissingCompanyIds()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
