/**
 * Bulk Sync Deal Emails
 * 
 * This script runs the email-deal linking service for all deals
 * to automatically link emails based on contact matching and domain matching
 */

import { PrismaClient } from '@prisma/client';
import { emailDealLinkingService } from '../src/modules/pipelines/services/emailDealLinkingService';

const prisma = new PrismaClient();

async function syncAllDealEmails() {
    try {
        console.log('🚀 Starting Bulk Email-Deal Sync...\n');

        // Get all deals
        const deals = await prisma.deal.findMany({
            select: { id: true, title: true },
        });

        console.log(`📊 Found ${deals.length} deals to process\n`);

        if (deals.length === 0) {
            console.log('⚠️  No deals found to sync');
            return;
        }

        // Run bulk sync (this uses the emailDealLinkingService)
        const userId = 1; // System user ID
        const result = await emailDealLinkingService.bulkLinkEmails(userId, {
            useContactMatching: true,
            useDomainMatching: true,
            useSubjectMatching: false,
            daysBefore: 30, // Search 30 days before deal creation
            daysAfter: 30,  // Search 30 days after last activity
        } as any);

        console.log('\n' + '='.repeat(60));
        console.log('✅ Bulk Sync Complete!');
        console.log(`📊 Deals Processed: ${result.dealsProcessed}`);
        console.log(`🔗 Total Links Created: ${result.totalLinksCreated}`);
        console.log(`📝 Log ID: ${result.logId}`);
        console.log('='.repeat(60) + '\n');

        // Show some stats
        const linkCount = await prisma.dealEmail.count();
        console.log(`\n📈 Current Statistics:`);
        console.log(`   Total Deal-Email Links: ${linkCount}`);

        // Show top deals with emails by counting email links
        const emailCounts = await prisma.dealEmail.groupBy({
            by: ['dealId'],
            _count: { emailId: true },
            orderBy: { _count: { emailId: 'desc' } },
            take: 10,
        });

        const dealIds = emailCounts.map((ec: any) => ec.dealId);
        const dealsData = await prisma.deal.findMany({
            where: { id: { in: dealIds } },
            select: { id: true, title: true },
        });

        const dealsWithEmails = emailCounts.map((ec: any) => {
            const deal = dealsData.find((d: any) => d.id === ec.dealId);
            return {
                id: ec.dealId,
                title: deal?.title || 'Unknown',
                emailCount: ec._count.emailId,
            };
        });

        if (dealsWithEmails.length > 0) {
            console.log(`\n📧 Top Deals with Emails:`);
            dealsWithEmails.forEach((deal: any, i: number) => {
                console.log(`   ${i + 1}. ${deal.title}: ${deal.emailCount} emails`);
            });
        }

    } catch (error) {
        console.error('❌ Error during sync:', error);
    } finally {
        await prisma.$disconnect();
    }
}

syncAllDealEmails();
