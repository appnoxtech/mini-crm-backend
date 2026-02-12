/**
 * Test Email-Deal Linking
 * 
 * This script creates a test email that matches a deal contact,
 * then runs linking to demonstrate the feature works.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testEmailLinking() {
    try {
        console.log('🧪 Testing Email-Deal Linking...\n');

        // Find a deal with contact email
        const dealWithEmail = await prisma.deal.findFirst({
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
            }
        });

        if (!dealWithEmail || !dealWithEmail.person?.userEmails?.[0]) {
            console.log('❌ No deals with contact emails found');
            console.log('💡 Run: npx ts-node scripts/importPeopleWithEmails.ts people_pipedrive.csv');
            return;
        }

        const contactEmail = dealWithEmail.person.userEmails[0].email;
        console.log(`📋 Found test deal: ${dealWithEmail.title}`);
        console.log(`👤 Contact: ${dealWithEmail.person.firstName} ${dealWithEmail.person.lastName}`);
        console.log(`📧 Contact email: ${contactEmail}\n`);

        // Get first email account ID
        const emailAccount = await prisma.emailAccount.findFirst();
        if (!emailAccount) {
            console.log('❌ No email account found. Please connect an email account first.');
            return;
        }

        // Create a test email from this contact
        console.log('📝 Creating test email...');
        const testEmail = await prisma.email.create({
            data: {
                accountId: emailAccount.id,
                messageId: `test-${Date.now()}@minicrm.local`,
                threadId: `thread-test-${Date.now()}`,
                from: contactEmail,
                to: ['john.lefas@appnox.tech'],
                subject: `Test email for ${dealWithEmail.title}`,
                body: 'This is a test email to demonstrate email-deal linking.',
                snippet: 'This is a test email...',
                sentAt: new Date(),
                receivedAt: new Date(),
                isRead: false,
                folder: 'INBOX'
            }
        });

        console.log(`✅ Created test email: ${testEmail.subject}\n`);

        // Now run the linking service
        console.log('🔗 Running email-deal linking...');
        const { emailDealLinkingService } = require('../src/modules/pipelines/services/emailDealLinkingService');
        
        const result = await emailDealLinkingService.linkEmailsToDeal(dealWithEmail.id, {
            useContactMatching: true,
            useDomainMatching: false,
            useSubjectMatching: false
        });

        console.log(`\n📊 Linking Results:`);
        console.log(`   Emails found: ${result.emailsFound}`);
        console.log(`   Links created: ${result.linksCreated}`);
        console.log(`   Method: ${result.method}\n`);

        if (result.linksCreated > 0) {
            console.log('✅ SUCCESS! Email linked to deal\n');
            
            // Verify the link
            const links = await prisma.dealEmail.findMany({
                where: { dealId: dealWithEmail.id },
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

            console.log('🔍 Linked emails:');
            links.forEach((link, i) => {
                console.log(`   ${i + 1}. ${link.email.subject}`);
                console.log(`      From: ${link.email.from}`);
                console.log(`      Method: ${link.linkedMethod}`);
                console.log(`      Confidence: ${link.confidenceScore}%\n`);
            });

            console.log('💡 How to view in UI:');
            console.log(`   1. Open deal: http://localhost:3000/deals/${dealWithEmail.id}`);
            console.log(`   2. Go to Activity tab`);
            console.log(`   3. Click Email sub-tab`);
            console.log(`   4. You should see the linked email!\n`);

        } else {
            console.log('⚠️  No links created. Checking why...\n');
            
            // Debug: Check if email exists
            const emailCheck = await prisma.email.findFirst({
                where: {
                    from: { equals: contactEmail, mode: 'insensitive' }
                }
            });
            
            if (emailCheck) {
                console.log('✅ Email exists in database');
            } else {
                console.log('❌ Email not found - this is the issue');
            }
        }

        // Cleanup test email
        console.log('\n🧹 Cleaning up test email...');
        await prisma.dealEmail.deleteMany({
            where: { emailId: testEmail.id }
        });
        await prisma.email.delete({
            where: { id: testEmail.id }
        });
        console.log('✅ Test email removed\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testEmailLinking();
