/**
 * Check Email Linking Status
 * 
 * This script checks:
 * 1. How many emails exist
 * 2. How many deals exist
 * 3. How many deal-email links exist
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEmailLinking() {
    try {
        console.log('📊 Checking Email Linking Status...\n');

        // Count emails
        const emailCount = await prisma.email.count();
        console.log(`📧 Total Emails: ${emailCount}`);

        // Count deals
        const dealCount = await prisma.deal.count();
        console.log(`💼 Total Deals: ${dealCount}`);

        // Count deal-email links
        const linkCount = await prisma.dealEmail.count();
        console.log(`🔗 Current Deal-Email Links: ${linkCount}\n`);

        // Show sample of deals with their contact info
        const sampleDeals = await prisma.deal.findMany({
            take: 5,
            include: {
                person: {
                    include: {
                        userEmails: true,
                    },
                },
                organization: true,
            },
        });

        console.log('📋 Sample Deals:');
        sampleDeals.forEach((deal, i) => {
            console.log(`\n${i + 1}. Deal: ${deal.title}`);
            console.log(`   ID: ${deal.id}`);
            if (deal.person) {
                const emails = deal.person.userEmails?.map(e => e.email) || [];
                console.log(`   Contact: ${deal.person.firstName} ${deal.person.lastName}`);
                console.log(`   Emails: ${emails.join(', ') || 'None'}`);
            }
            if (deal.organization) {
                console.log(`   Organization: ${deal.organization.name}`);
            }
        });

        // Show sample of emails
        console.log('\n\n📧 Sample Emails:');
        const sampleEmails = await prisma.email.findMany({
            take: 5,
            orderBy: { sentAt: 'desc' },
            select: {
                id: true,
                subject: true,
                from: true,
                to: true,
                sentAt: true,
            },
        });

        sampleEmails.forEach((email, i) => {
            console.log(`\n${i + 1}. ${email.subject}`);
            console.log(`   From: ${email.from}`);
            console.log(`   To: ${JSON.stringify(email.to)}`);
            console.log(`   Date: ${email.sentAt}`);
        });

        console.log('\n\n' + '='.repeat(60));
        if (linkCount === 0) {
            console.log('⚠️  NO EMAIL LINKS FOUND!');
            console.log('📌 You need to run the bulk email sync to link emails to deals.');
            console.log('💡 Run: npm run sync-deal-emails');
        } else {
            console.log(`✅ Found ${linkCount} email-deal links`);
        }
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkEmailLinking();
