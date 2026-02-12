/**
 * Bulk Email-Deal Linking Script
 * 
 * This script performs the initial one-time linking of all historical emails to imported deals.
 * Run this after importing deals from Pipedrive to retroactively link existing emails.
 * 
 * Usage:
 *   npx ts-node scripts/bulkLinkEmailsToDeals.ts [dealIds...]
 *   
 * Examples:
 *   npx ts-node scripts/bulkLinkEmailsToDeals.ts          # Link emails for ALL deals
 *   npx ts-node scripts/bulkLinkEmailsToDeals.ts 1 2 3    # Link emails for specific deals
 */

import { PrismaClient } from '@prisma/client';
import { emailDealLinkingService } from '../src/modules/pipelines/services/emailDealLinkingService';

const prisma = new PrismaClient();

interface BulkLinkOptions {
    dealIds?: number[];
    useContactMatching?: boolean;
    useDomainMatching?: boolean;
    useSubjectMatching?: boolean;
    batchSize?: number;
}

async function bulkLinkEmailsToDeals(options: BulkLinkOptions = {}) {
    const {
        dealIds,
        useContactMatching = true,
        useDomainMatching = true,
        useSubjectMatching = false,
        batchSize = 10,
    } = options;

    console.log('🔗 Starting bulk email-deal linking process...\n');
    console.log('Options:');
    console.log(`  - Contact matching: ${useContactMatching ? '✓' : '✗'}`);
    console.log(`  - Domain matching: ${useDomainMatching ? '✓' : '✗'}`);
    console.log(`  - Subject matching: ${useSubjectMatching ? '✓' : '✗'}`);
    console.log(`  - Batch size: ${batchSize}\n`);

    try {
        // Get deals to process
        const deals = await prisma.deal.findMany({
            where: dealIds && dealIds.length > 0 ? { id: { in: dealIds } } : {},
            select: {
                id: true,
                title: true,
                createdAt: true,
                emailSyncStatus: true,
            },
            orderBy: { id: 'asc' },
        });

        console.log(`📊 Found ${deals.length} deals to process\n`);

        if (deals.length === 0) {
            console.log('⚠️  No deals found to process');
            return;
        }

        let totalDealsProcessed = 0;
        let totalLinksCreated = 0;
        let totalErrors = 0;

        // Process deals in batches
        for (let i = 0; i < deals.length; i += batchSize) {
            const batch = deals.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(deals.length / batchSize);

            console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} deals)...\n`);

            for (const deal of batch) {
                try {
                    const dealTitle = deal.title.length > 40
                        ? `${deal.title.substring(0, 40)}...`
                        : deal.title;

                    process.stdout.write(`  [${totalDealsProcessed + 1}/${deals.length}] Processing "${dealTitle}"... `);

                    const result = await emailDealLinkingService.linkEmailsToDeal(deal.id, {
                        useContactMatching,
                        useDomainMatching,
                        useSubjectMatching,
                    });

                    totalLinksCreated += result.linksCreated;
                    totalDealsProcessed++;

                    if (result.linksCreated > 0) {
                        console.log(`✓ Linked ${result.linksCreated} email(s)`);
                    } else {
                        console.log(`ℹ️  No emails found`);
                    }
                } catch (error) {
                    totalErrors++;
                    console.log(`✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            // Brief pause between batches to avoid overwhelming the database
            if (i + batchSize < deals.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        console.log('\n' + '='.repeat(70));
        console.log('📈 SUMMARY');
        console.log('='.repeat(70));
        console.log(`Total deals processed:    ${totalDealsProcessed}`);
        console.log(`Total email links created: ${totalLinksCreated}`);
        console.log(`Total errors:             ${totalErrors}`);
        console.log(`Average links per deal:   ${totalDealsProcessed > 0 ? (totalLinksCreated / totalDealsProcessed).toFixed(2) : '0'}`);
        console.log('='.repeat(70));

        console.log('\n✅ Bulk linking complete!');
    } catch (error) {
        console.error('\n❌ Fatal error during bulk linking:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dealIdsFromArgs = args
    .filter(arg => !arg.startsWith('--'))
    .map(arg => parseInt(arg))
    .filter(id => !isNaN(id));

const useContactMatching = !args.includes('--no-contact');
const useDomainMatching = !args.includes('--no-domain');
const useSubjectMatching = args.includes('--use-subject');
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1] || '10') : 10;

// Run the script
bulkLinkEmailsToDeals({
    dealIds: dealIdsFromArgs.length > 0 ? dealIdsFromArgs : undefined,
    useContactMatching,
    useDomainMatching,
    useSubjectMatching,
    batchSize,
}).catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
});
