/**
 * Simple Test: Email-Deal Linking Demo
 * 
 * This script demonstrates how to test email-deal linking
 * by checking if any existing emails can be linked to deals.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testLinking() {
    try {
        console.log('🧪 Testing Email-Deal Linking with Existing Data...\n');

        // Step 1: Find deals with contact emails
        console.log('📋 Step 1: Finding deals with contact emails...');
        const dealsWithEmails = await prisma.deal.findMany({
            where: {
                person: {
                    userEmails: {
                        some: {}
                    }
                }
            },
            include: {
                person: {
                    include: {
                        userEmails: true
                    }
                }
            },
            take: 10
        });

        console.log(`   Found ${dealsWithEmails.length} deals with contact emails\n`);

        if (dealsWithEmails.length === 0) {
            console.log('❌ No deals with contact emails found.');
            console.log('💡 First import people with emails:');
            console.log('   npx ts-node scripts/importPeopleWithEmails.ts people_pipedrive.csv\n');
            return;
        }

        // Step 2: Check if any emails match these contacts
        console.log('📧 Step 2: Checking for matching emails...\n');
        
        let matchFound = false;
        for (const deal of dealsWithEmails) {
            const contactEmails = deal.person?.userEmails?.map(e => e.email.toLowerCase()) || [];
            
            if (contactEmails.length === 0) continue;

            // Check if any emails exist from these contacts
            const matchingEmail = await prisma.email.findFirst({
                where: {
                    from: { in: contactEmails, mode: 'insensitive' }
                },
                select: {
                    id: true,
                    from: true,
                    subject: true,
                    sentAt: true
                }
            });

            if (matchingEmail) {
                matchFound = true;
                console.log(`✅ MATCH FOUND!`);
                console.log(`   Deal: ${deal.title}`);
                console.log(`   Contact: ${deal.person?.firstName} ${deal.person?.lastName}`);
                console.log(`   Contact Email: ${contactEmails.join(', ')}`);
                console.log(`   Matching Email: ${matchingEmail.subject}`);
                console.log(`   From: ${matchingEmail.from}\n`);

                // Test linking this specific deal
                console.log('🔗 Step 3: Testing bulk linking for this deal...\n');
                const { emailDealLinkingService } = require('../src/modules/pipelines/services/emailDealLinkingService');
                
                const result = await emailDealLinkingService.linkEmailsToDeal(deal.id, {
                    useContactMatching: true,
                    useDomainMatching: false,
                    useSubjectMatching: false
                });

                console.log(`📊 Linking Results:`);
                console.log(`   Emails found: ${result.emailsFound}`);
                console.log(`   Links created: ${result.linksCreated}`);
                console.log(`   Method: ${result.method}\n`);

                if (result.linksCreated > 0) {
                    console.log('✅ SUCCESS! Email linked to deal!\n');
                    console.log('💡 To view in the UI:');
                    console.log(`   1. Open: http://localhost:3000/deals/${deal.id}`);
                    console.log(`   2. Go to Activity tab → Email sub-tab`);
                    console.log(`   3. You'll see the linked email!\n`);

                    // Show the linked emails
                    const links = await prisma.dealEmail.findMany({
                        where: { dealId: deal.id },
                        include: {
                            email: {
                                select: {
                                    subject: true,
                                    from: true,
                                    sentAt: true
                                }
                            }
                        }
                    });

                    console.log('📧 Linked Emails:');
                    links.forEach((link, i) => {
                        console.log(`   ${i + 1}. ${link.email.subject}`);
                        console.log(`      From: ${link.email.from}`);
                        console.log(`      Date: ${link.email.sentAt}`);
                        console.log(`      Confidence: ${link.confidenceScore}%\n`);
                    });
                }

                break; // Only test one deal
            }
        }

        if (!matchFound) {
            console.log('❌ No matching emails found.\n');
            console.log('📌 This means:');
            console.log('   - Your deals have contact emails (e.g., jason@pachyderm.io)');
            console.log('   - But your email database has different emails (e.g., john.lefas@appnox.tech)');
            console.log('   - There is no overlap between the two\n');
            
            console.log('💡 Solutions:');
            console.log('   1. Connect the email account that matches your deal contacts');
            console.log('   2. Use Pipedrive API to import historical emails');
            console.log('   3. Send test emails from deal contacts to create linkable data\n');
            
            console.log('📊 Current Data:');
            console.log(`   Deals with emails: ${dealsWithEmails.length}`);
            console.log(`   Sample contact emails:`);
            dealsWithEmails.slice(0, 5).forEach(deal => {
                const emails = deal.person?.userEmails?.map(e => e.email) || [];
                if (emails.length > 0) {
                    console.log(`   - ${emails.join(', ')}`);
                }
            });
            
            const sampleEmails = await prisma.email.findMany({
                take: 5,
                select: { from: true }
            });
            console.log(`\n   Sample emails in database:`);
            sampleEmails.forEach(e => {
                console.log(`   - ${e.from}`);
            });
            console.log();
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testLinking();
