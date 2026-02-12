/**
 * Test Email Extraction from JSON Fields
 * 
 * This script tests if we can properly extract emails from Person.emails JSON field
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testEmailExtraction() {
    try {
        console.log('🔍 Testing Email Extraction from JSON Fields...\n');

        // Get a sample deal with person data
        const deal = await prisma.deal.findFirst({
            where: {
                personId: { not: null }
            },
            include: {
                person: true,
                organization: true,
            },
        });

        if (!deal) {
            console.log('❌ No deals with person found');
            return;
        }

        console.log(`📋 Deal: ${deal.title}`);
        console.log(`   ID: ${deal.id}`);
        
        if (deal.person) {
            console.log(`\n👤 Person: ${deal.person.firstName} ${deal.person.lastName}`);
            console.log(`   Person ID: ${deal.person.id}`);
            console.log(`   Emails JSON: ${JSON.stringify(deal.person.emails)}`);
            
            // Try to extract emails
            const emailsField = deal.person.emails;
            let extractedEmails: string[] = [];
            
            if (Array.isArray(emailsField)) {
                extractedEmails = emailsField
                    .map((item: any) => {
                        if (typeof item === 'string') return item;
                        if (item.email) return item.email;
                        if (item.value) return item.value;
                        return null;
                    })
                    .filter(Boolean);
            }
            
            console.log(`   ✅ Extracted Emails: ${extractedEmails.join(', ') || 'None'}`);
        }

        if (deal.organization) {
            console.log(`\n🏢 Organization: ${deal.organization.name}`);
            console.log(`   Emails JSON: ${JSON.stringify(deal.organization.emails)}`);
        }

        console.log(`\n📧 Deal Email Field: ${JSON.stringify(deal.email)}`);

        // Now test finding matching emails
        console.log('\n\n🔍 Searching for matching emails in database...');
        
        const personEmails = deal.person?.emails as any;
        let emailAddresses: string[] = [];
        
        if (Array.isArray(personEmails)) {
            emailAddresses = personEmails
                .map((item: any) => {
                    if (typeof item === 'string') return item;
                    if (item.email) return item.email;
                    if (item.value) return item.value;
                    return null;
                })
                .filter(Boolean)
                .map((e: string) => e.toLowerCase());
        }

        console.log(`   Looking for emails: ${emailAddresses.join(', ')}`);

        if (emailAddresses.length > 0) {
            const matchingEmails = await prisma.email.findMany({
                where: {
                    from: { in: emailAddresses, mode: 'insensitive' }
                },
                take: 5,
                select: {
                    id: true,
                    subject: true,
                    from: true,
                    sentAt: true,
                }
            });

            console.log(`\n   ✅ Found ${matchingEmails.length} matching emails by FROM field`);
            matchingEmails.forEach((email, i) => {
                console.log(`      ${i + 1}. ${email.subject} (from: ${email.from})`);
            });
        } else {
            console.log('   ⚠️  No email addresses to search for');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testEmailExtraction();
