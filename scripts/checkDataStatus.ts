/**
 * Quick Database Check
 * Run this before bulk linking to see if you have data ready
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function quickCheck() {
    try {
        const dealCount = await prisma.deal.count();
        const emailCount = await prisma.email.count();
        const linkCount = await prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) as count FROM deal_emails`;

        console.log('\n📊 DATABASE STATUS:');
        console.log('='.repeat(50));
        console.log(`Deals:         ${dealCount.toLocaleString()}`);
        console.log(`Emails:        ${emailCount.toLocaleString()}`);
        console.log(`Existing Links: ${Number(linkCount[0].count).toLocaleString()}`);
        console.log('='.repeat(50));

        if (dealCount > 0 && emailCount > 0) {
            console.log('\n✅ Ready to run bulk linking!');
            console.log('\nNext step:');
            console.log('  npx ts-node scripts/bulkLinkEmailsToDeals.ts\n');
        } else if (dealCount === 0) {
            console.log('\n❌ No deals found. Import deals first.');
        } else if (emailCount === 0) {
            console.log('\n❌ No emails found. Set up email sync first.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

quickCheck();
