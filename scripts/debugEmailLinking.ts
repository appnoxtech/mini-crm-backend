/**
 * Debug Email Linking
 * 
 * This script helps debug why emails aren't being linked to deals
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugEmailLinking() {
    try {
        console.log('🔍 Debugging Email Linking...\n');

        // Get a sample deal with full details
        const sampleDeal = await prisma.deal.findFirst({
            include: {
                person: {
                    include: {
                        userEmails: true,
                    },
                },
                organization: true,
            },
        });

        if (!sampleDeal) {
            console.log('❌ No deals found');
            return;
        }

        console.log('📋 Sample Deal Analysis:');
        console.log(`Deal: ${sampleDeal.title} (ID: ${sampleDeal.id})`);
        console.log(`\nPerson Info:`);
        if (sampleDeal.person) {
            console.log(`  Name: ${sampleDeal.person.firstName} ${sampleDeal.person.lastName || ''}`);
            console.log(`  Person Emails (from PersonEmail table): ${sampleDeal.person.userEmails?.map(e => e.email).join(', ') || 'None'}`);
            console.log(`  Person Emails (from JSON field): ${JSON.stringify(sampleDeal.person.emails)}`);
        } else {
            console.log(`  No person linked`);
        }

        console.log(`\nOrganization Info:`);
        if (sampleDeal.organization) {
            console.log(`  Name: ${sampleDeal.organization.name}`);
            console.log(`  Emails (JSON field): ${JSON.stringify(sampleDeal.organization.emails)}`);
        } else {
            console.log(`  No organization linked`);
        }

        console.log(`\nDeal Email field (JSON): ${JSON.stringify(sampleDeal.email)}`);

        // Check emails
        console.log('\n\n📧 Sample Emails Analysis:');
        const sampleEmails = await prisma.email.findMany({
            take: 3,
            orderBy: { sentAt: 'desc' },
        });

        sampleEmails.forEach((email, i) => {
            console.log(`\n${i + 1}. ${email.subject}`);
            console.log(`   From: ${email.from}`);
            console.log(`   To: ${JSON.stringify(email.to)}`);

            // Extract domain from 'from'
            const fromDomain = email.from.match(/@([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
            if (fromDomain) {
                console.log(`   From Domain: ${fromDomain[1]}`);
            }
        });

        console.log('\n\n💡 Common Issues:');
        console.log('1. Person emails might be in JSON format instead of PersonEmail table');
        console.log('2. Organization emails might not match email domains');
        console.log('3. Deal email field might not contain contact emails');
        console.log('\n📌 Solution: Check the emailDealLinkingService.ts extractEmails() method');
        console.log('   and ensure it properly extracts emails from JSON fields.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugEmailLinking();
