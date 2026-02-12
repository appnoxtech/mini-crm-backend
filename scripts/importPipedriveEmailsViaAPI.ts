/**
 * Import Email Messages from Pipedrive API
 * 
 * This script uses Pipedrive API to fetch actual email messages
 * and import them into Mini-CRM with deal linkage.
 * 
 * Prerequisites:
 * 1. Pipedrive API token
 * 2. Deals already imported
 * 3. People already imported with emails
 * 
 * Usage:
 *   PIPEDRIVE_API_TOKEN=your_token npx ts-node scripts/importPipedriveEmailsViaAPI.ts
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

interface PipedriveEmail {
    id: number;
    from: Array<{ email_address: string; name: string }>;
    to: Array<{ email_address: string; name: string }>;
    cc: Array<{ email_address: string; name: string }>;
    subject: string;
    snippet: string;
    body_url: string;
    mail_thread_id: number;
    mail_message_id: string;
    timestamp: string;
    s3_bucket: string;
    s3_bucket_path: string;
    deal_id?: number;
    person_id?: number;
    organization_id?: number;
}

const PIPEDRIVE_API_TOKEN = process.env.PIPEDRIVE_API_TOKEN;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'api.pipedrive.com';

if (!PIPEDRIVE_API_TOKEN) {
    console.error('❌ Error: PIPEDRIVE_API_TOKEN environment variable is required');
    console.log('\nUsage:');
    console.log('  PIPEDRIVE_API_TOKEN=your_token npx ts-node scripts/importPipedriveEmailsViaAPI.ts');
    console.log('\nGet your API token from:');
    console.log('  Pipedrive → Settings → Personal preferences → API');
    process.exit(1);
}

async function fetchPipedriveEmails(dealId?: number): Promise<PipedriveEmail[]> {
    try {
        const url = dealId
            ? `https://${PIPEDRIVE_DOMAIN}/v1/deals/${dealId}/mailMessages`
            : `https://${PIPEDRIVE_DOMAIN}/v1/mailMessages`;

        const response = await axios.get(url, {
            params: {
                api_token: PIPEDRIVE_API_TOKEN,
                limit: 500
            }
        });

        if (response.data.success) {
            return response.data.data || [];
        }

        return [];
    } catch (error: any) {
        console.error(`❌ Error fetching emails from Pipedrive:`, error.message);
        return [];
    }
}

async function fetchEmailBody(bodyUrl: string): Promise<string> {
    try {
        const response = await axios.get(bodyUrl, {
            params: {
                api_token: PIPEDRIVE_API_TOKEN
            }
        });
        return response.data || '';
    } catch (error) {
        console.error('Failed to fetch email body:', error);
        return '';
    }
}

async function importEmail(pipedriveEmail: PipedriveEmail): Promise<boolean> {
    try {
        // Extract email addresses
        const fromEmail = pipedriveEmail.from[0]?.email_address;
        const toEmails = pipedriveEmail.to.map(t => t.email_address);
        const ccEmails = pipedriveEmail.cc?.map(c => c.email_address) || [];

        if (!fromEmail) {
            console.log('⚠️  Skipping email without from address');
            return false;
        }

        // Check if email already exists
        const existing = await prisma.email.findFirst({
            where: {
                messageId: pipedriveEmail.mail_message_id
            }
        });

        if (existing) {
            console.log(`⏭️  Email already exists: ${pipedriveEmail.subject}`);
            return false;
        }

        // Fetch full email body
        const body = pipedriveEmail.body_url
            ? await fetchEmailBody(pipedriveEmail.body_url)
            : pipedriveEmail.snippet;

        // Create email record
        const email = await prisma.email.create({
            data: {
                messageId: pipedriveEmail.mail_message_id,
                threadId: pipedriveEmail.mail_thread_id?.toString(),
                from: fromEmail,
                to: toEmails,
                cc: ccEmails.length > 0 ? ccEmails : null,
                subject: pipedriveEmail.subject || '(No Subject)',
                bodyText: body,
                bodyHtml: body,
                snippet: pipedriveEmail.snippet,
                sentAt: new Date(pipedriveEmail.timestamp),
                receivedAt: new Date(pipedriveEmail.timestamp),
                isRead: true,
                folder: 'INBOX',
                labels: ['imported', 'pipedrive']
            }
        });

        console.log(`✅ Imported: ${pipedriveEmail.subject}`);

        // Link to deal if deal_id exists
        if (pipedriveEmail.deal_id) {
            // Find deal by Pipedrive ID (you may need to adjust this based on your import)
            const deal = await prisma.deal.findFirst({
                where: {
                    // Assuming you stored Pipedrive ID somewhere during import
                    // You may need to adjust this query
                    title: { contains: pipedriveEmail.deal_id.toString() }
                }
            });

            if (deal) {
                await prisma.dealEmail.create({
                    data: {
                        dealId: deal.id,
                        emailId: email.id,
                        linkedBy: 'pipedrive_import',
                        linkedMethod: 'manual',
                        confidenceScore: 100
                    }
                });
                console.log(`   🔗 Linked to deal: ${deal.title}`);
            }
        }

        return true;
    } catch (error: any) {
        console.error(`❌ Error importing email:`, error.message);
        return false;
    }
}

async function importAllPipedriveEmails() {
    console.log('🚀 Starting Pipedrive Email Import via API...\n');

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    try {
        // Fetch all emails from Pipedrive
        console.log('📧 Fetching emails from Pipedrive API...');
        const emails = await fetchPipedriveEmails();
        console.log(`📊 Found ${emails.length} emails to import\n`);

        // Import each email
        for (let i = 0; i < emails.length; i++) {
            const email = emails[i];
            console.log(`[${i + 1}/${emails.length}] Processing: ${email.subject}`);

            const success = await importEmail(email);
            if (success) {
                imported++;
            } else {
                skipped++;
            }

            // Progress update every 50 emails
            if ((i + 1) % 50 === 0) {
                console.log(`\n📈 Progress: ${i + 1}/${emails.length} processed\n`);
            }
        }

        // Print summary
        console.log('\n' + '='.repeat(70));
        console.log('📊 IMPORT SUMMARY');
        console.log('='.repeat(70));
        console.log(`Total emails:     ${emails.length}`);
        console.log(`✅ Imported:      ${imported}`);
        console.log(`⏭️  Skipped:       ${skipped}`);
        console.log(`❌ Failed:        ${failed}`);
        console.log('='.repeat(70));

        console.log('\n✅ Pipedrive email import complete!');
        console.log('\n💡 Next step: Run bulk linking to link emails to deals:');
        console.log('   npx ts-node scripts/bulkLinkEmailsToDeals.ts');

    } catch (error: any) {
        console.error('❌ Fatal error:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Main execution
importAllPipedriveEmails();
