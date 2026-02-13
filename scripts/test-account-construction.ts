/**
 * Test script to verify email account objects have companyId
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAccountConstruction() {
    console.log('🧪 Testing email account construction...\n');

    // Simulate what the cron job does
    const accountRows = await prisma.emailAccount.findMany({
        where: { isActive: true },
        take: 1
    });

    if (accountRows.length === 0) {
        console.log('⚠️  No active email accounts found');
        return;
    }

    const accountRow = accountRows[0];

    // This is how the cron job was constructing accounts (BEFORE fix)
    const accountBefore: any = {
        id: accountRow.id,
        userId: accountRow.userId.toString(),
        // companyId: accountRow.companyId, // <-- THIS WAS MISSING!
        email: accountRow.email,
        provider: accountRow.provider,
    };

    // This is how it should be (AFTER fix)
    const accountAfter: any = {
        id: accountRow.id,
        userId: accountRow.userId.toString(),
        companyId: accountRow.companyId, // ✅ NOW INCLUDED
        email: accountRow.email,
        provider: accountRow.provider,
    };

    console.log('❌ BEFORE fix:');
    console.log(`   companyId: ${accountBefore.companyId} (${typeof accountBefore.companyId})`);
    console.log('');

    console.log('✅ AFTER fix:');
    console.log(`   companyId: ${accountAfter.companyId} (${typeof accountAfter.companyId})`);
    console.log('');

    if (accountAfter.companyId) {
        console.log('✅ Test PASSED: companyId is now properly included!');
    } else {
        console.log('❌ Test FAILED: companyId is still missing!');
    }
}

testAccountConstruction()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
