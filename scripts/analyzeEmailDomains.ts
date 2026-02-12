/**
 * Analyze Email Domains
 * 
 * This script analyzes what email domains exist in the database
 * and compares them with deal organization names
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeEmailDomains() {
    try {
        console.log('🔍 Analyzing Email Domains...\n');

        // Get sample emails and extract domains
        const emails = await prisma.email.findMany({
            take: 20,
            select: {
                id: true,
                from: true,
                to: true,
                subject: true,
            },
        });

        console.log('📧 Sample Email Domains:');
        const emailDomains = new Set<string>();
        
        emails.forEach((email, i) => {
            const fromDomain = email.from.split('@')[1];
            if (fromDomain) {
                emailDomains.add(fromDomain.toLowerCase());
                console.log(`${i + 1}. From: ${email.from} → Domain: ${fromDomain}`);
            }
        });

        console.log(`\n✅ Found ${emailDomains.size} unique email domains`);
        console.log('Domains:', Array.from(emailDomains).join(', '));

        // Get sample deals and their organization names
        console.log('\n\n🏢 Sample Deal Organizations:');
        const deals = await prisma.deal.findMany({
            take: 20,
            where: {
                organizationId: { not: null }
            },
            include: {
                organization: true,
            },
        });

        const orgNames = new Set<string>();
        deals.forEach((deal, i) => {
            if (deal.organization) {
                orgNames.add(deal.organization.name.toLowerCase());
                console.log(`${i + 1}. ${deal.title} → Org: ${deal.organization.name}`);
            }
        });

        console.log('\n\n🔍 Checking for domain matches...');
        let matchCount = 0;
        
        for (const domain of emailDomains) {
            for (const orgName of orgNames) {
                if (orgName.includes(domain.replace(/\.[^.]+$/, ''))) {
                    console.log(`✅ Match found: ${domain} ↔ ${orgName}`);
                    matchCount++;
                }
            }
        }

        if (matchCount === 0) {
            console.log('❌ No domain matches found between emails and organizations');
            console.log('\n💡 This explains why linking returned 0 results.');
            console.log('📌 The emails in your database are from different domains than your Pipedrive deals.');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

analyzeEmailDomains();
