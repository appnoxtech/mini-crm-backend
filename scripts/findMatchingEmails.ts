/**
 * Find Matching Emails Between Deals and Email Database
 * 
 * This script checks if any emails in the database match the contact emails from deals
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findMatchingEmails() {
    try {
        console.log('🔍 Finding Matching Emails...\n');

        // Get deals with contact emails
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
            take: 100
        });

        console.log(`📋 Found ${dealsWithEmails.length} deals with contact emails\n`);

        // Extract all contact emails
        const contactEmails = new Set<string>();
        dealsWithEmails.forEach(deal => {
            deal.person?.userEmails?.forEach(e => {
                contactEmails.add(e.email.toLowerCase());
            });
        });

        console.log(`📧 Total unique contact emails: ${contactEmails.size}\n`);
        console.log('Sample contact emails:');
        Array.from(contactEmails).slice(0, 10).forEach((email, i) => {
            console.log(`  ${i + 1}. ${email}`);
        });

        // Search for matching emails in the Email table
        console.log('\n\n🔍 Searching for matches in Email table...\n');
        
        const contactEmailsArray = Array.from(contactEmails);
        let matchCount = 0;
        const matches: any[] = [];

        for (const contactEmail of contactEmailsArray) {
            const matchingEmails = await prisma.email.findMany({
                where: {
                    OR: [
                        { from: { equals: contactEmail, mode: 'insensitive' } },
                        { from: { contains: contactEmail, mode: 'insensitive' } }
                    ]
                },
                take: 1,
                select: {
                    id: true,
                    from: true,
                    subject: true
                }
            });

            if (matchingEmails.length > 0) {
                matchCount++;
                matches.push({
                    contactEmail,
                    emailFrom: matchingEmails[0].from,
                    subject: matchingEmails[0].subject
                });
                
                if (matches.length <= 10) {
                    console.log(`✅ Match found: ${contactEmail} → ${matchingEmails[0].subject}`);
                }
            }
        }

        console.log(`\n\n📊 Results:`);
        console.log(`Total contact emails checked: ${contactEmailsArray.length}`);
        console.log(`Matching emails found: ${matchCount}`);
        console.log(`Match rate: ${((matchCount / contactEmailsArray.length) * 100).toFixed(2)}%`);

        if (matchCount === 0) {
            console.log('\n❌ NO MATCHES FOUND!');
            console.log('📌 This explains why bulk linking returns 0 results.');
            console.log('💡 The emails in your database are from different people than your Pipedrive contacts.');
            console.log('\n🔧 Solutions:');
            console.log('   1. Import emails from the same email accounts as your Pipedrive contacts');
            console.log('   2. Send test emails between your CRM contacts to create linkable data');
            console.log('   3. Use the real-time linking feature for NEW emails going forward');
        } else {
            console.log(`\n✅ Found ${matchCount} potential matches!`);
            console.log('💡 Running bulk linking should create links for these emails.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

findMatchingEmails();
