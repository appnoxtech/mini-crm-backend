import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Fix Missing Email Activities
 * 
 * This script identifies emails that are linked to deals (via DealEmail junction table 
 * or Email.dealIds array) but are missing a corresponding DealActivity record.
 * Creating these records ensures they appear in the Deal History timeline.
 */
async function fixEmailActivities() {
    try {
        console.log('🚀 Starting Email Activity Fix (Backfill)...\n');

        // 1. Get all links from DealEmail junction table
        const links = await prisma.dealEmail.findMany({
            include: {
                email: {
                    include: { content: true }
                }
            }
        });

        console.log(`📊 Found ${links.length} deal-email links in junction table. Checking activities...`);

        let fixedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (const link of links) {
            const email = link.email as any;
            const dealId = link.dealId;

            if (!email) {
                console.log(`⚠️  Skipping link with missing email: ${link.emailId}`);
                continue;
            }

            // Get full content if available
            const content = email.content;
            const body = content?.body || email.body || "";
            const htmlBody = content?.htmlBody || email.htmlBody || null;

            // 2. Check if a DealActivity already exists for this deal and this email
            const activities = await prisma.dealActivity.findMany({
                where: {
                    dealId: dealId,
                    activityType: 'mail'
                }
            });

            // Match by messageId in the JSON field
            const exists = activities.some((a: any) => {
                const eData = a.email;
                if (!eData) return false;
                // Check multiple fields to be sure (some old records might miss messageId)
                return eData.messageId === email.messageId ||
                    (eData.subject === email.subject && Math.abs(new Date(a.createdAt).getTime() - new Date(email.sentAt).getTime()) < 60000);
            });

            if (!exists) {
                try {
                    // Fetch the deal to get user ID
                    const deal = await prisma.deal.findUnique({
                        where: { id: dealId },
                        select: { userId: true }
                    });

                    // 3. Create missing activity
                    await prisma.dealActivity.create({
                        data: {
                            dealId: dealId,
                            userId: deal?.userId || 1,
                            activityType: 'mail',
                            subject: email.subject || "(No Subject)",
                            label: email.isIncoming ? 'incoming' : 'outgoing',
                            priority: 'none',
                            busyFree: 'free',
                            email: {
                                from: email.from,
                                to: email.to || [],
                                cc: email.cc || [],
                                bcc: email.bcc || [],
                                subject: email.subject,
                                body: body,
                                htmlBody: htmlBody,
                                threadId: email.threadId,
                                messageId: email.messageId
                            } as any,
                            organization: email.isIncoming ? email.from : (Array.isArray(email.to) ? email.to.join(', ') : String(email.to)),
                            isDone: true,
                            completedAt: email.receivedAt || email.sentAt || new Date(),
                            createdAt: email.sentAt || email.receivedAt || new Date()
                        }
                    });

                    // Also ensure Email.dealIds array is synced
                    const currentDealIds = (email.dealIds as string[]) || [];
                    if (!currentDealIds.includes(String(dealId))) {
                        await prisma.email.update({
                            where: { id: email.id },
                            data: {
                                dealIds: [...currentDealIds, String(dealId)],
                                isLinkedToDeal: true
                            }
                        });
                    }

                    fixedCount++;
                    if (fixedCount % 10 === 0) process.stdout.write('.');
                } catch (err: any) {
                    console.error(`\n❌ Error creating activity for email ${email.id}:`, err.message);
                    errorCount++;
                }
            } else {
                skippedCount++;
            }
        }

        console.log(`\n\n✅ Backfill Complete!`);
        console.log(`🔗 Activities Created: ${fixedCount}`);
        console.log(`✨ Already Exist: ${skippedCount}`);
        if (errorCount > 0) console.log(`❌ Errors Encountered: ${errorCount}`);

    } catch (error) {
        console.error('\n❌ Fatal error during backfill:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixEmailActivities();
