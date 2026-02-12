/**
 * Email-Deal Linking Service
 * 
 * This service handles the automatic and manual linking of emails to deals
 * based on contact matching, domain matching, and subject line matching.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ContactEmail {
    email: string;
    personId?: number;
}

interface EmailMatchResult {
    emailId: string;
    confidenceScore: number;
    linkedMethod: 'auto_contact' | 'auto_domain' | 'auto_subject' | 'manual';
}

export class EmailDealLinkingService {
    /**
     * Extract email addresses from JSON field
     */
    private extractEmails(jsonField: any): string[] {
        if (!jsonField) return [];

        if (Array.isArray(jsonField)) {
            return jsonField
                .map(item => typeof item === 'string' ? item : item.email || item.value)
                .filter(Boolean);
        }

        if (typeof jsonField === 'string') {
            return [jsonField];
        }

        if (typeof jsonField === 'object' && jsonField.email) {
            return [jsonField.email];
        }

        return [];
    }

    /**
     * Get contact emails for a deal
     */
    private async getContactEmailsForDeal(dealId: number): Promise<ContactEmail[]> {
        const deal = await prisma.deal.findUnique({
            where: { id: dealId },
            include: {
                person: {
                    include: {
                        userEmails: true,
                    },
                },
                organization: true,
            },
        });

        if (!deal) return [];

        const contactEmails: ContactEmail[] = [];

        // Get emails from associated person
        if (deal.person) {
            // From PersonEmail table
            if (deal.person.userEmails) {
                contactEmails.push(
                    ...deal.person.userEmails.map(pe => ({
                        email: pe.email.toLowerCase(),
                        personId: deal.person!.id,
                    }))
                );
            }

            // From Person.emails JSON field
            const personEmails = this.extractEmails(deal.person.emails);
            contactEmails.push(
                ...personEmails.map(email => ({
                    email: email.toLowerCase(),
                    personId: deal.person!.id,
                }))
            );
        }

        // Get emails from organization
        if (deal.organization) {
            const orgEmails = this.extractEmails(deal.organization.emails);
            contactEmails.push(
                ...orgEmails.map(email => ({
                    email: email.toLowerCase(),
                }))
            );
        }

        // Get emails from deal itself
        const dealEmails = this.extractEmails(deal.email);
        contactEmails.push(
            ...dealEmails.map(email => ({
                email: email.toLowerCase(),
            }))
        );

        // Deduplicate by email address
        const uniqueEmails = new Map<string, ContactEmail>();
        contactEmails.forEach(ce => {
            if (!uniqueEmails.has(ce.email)) {
                uniqueEmails.set(ce.email, ce);
            }
        });

        return Array.from(uniqueEmails.values());
    }

    /**
     * Extract domain from organization name or email
     */
    private extractDomain(orgName: string | null): string | null {
        if (!orgName) return null;

        // Try to extract domain from organization name
        // e.g., "flies.com deal" -> "flies.com"
        const domainMatch = orgName.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
        if (domainMatch && domainMatch[1]) {
            return domainMatch[1].toLowerCase();
        }

        return null;
    }

    /**
     * Check if email address matches domain
     */
    private emailMatchesDomain(email: string, domain: string): boolean {
        const emailDomain = email.split('@')[1];
        if (!emailDomain) return false;
        return emailDomain.toLowerCase() === domain.toLowerCase();
    }

    /**
     * Find matching emails for a deal using contact-based matching (highest confidence)
     */
    private async findEmailsByContact(
        dealId: number,
        contactEmails: ContactEmail[],
        startDate: Date,
        endDate: Date
    ): Promise<EmailMatchResult[]> {
        if (contactEmails.length === 0) return [];

        const emailAddresses = contactEmails.map(ce => ce.email);

        // Find emails where from/to/cc matches any contact email
        const matchingEmails = await prisma.email.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { from: { in: emailAddresses, mode: 'insensitive' } },
                            // For JSON fields, we need to use raw SQL for contains check
                            // This is a simplified version - in production you might want to use raw queries
                        ],
                    },
                    {
                        OR: [
                            { sentAt: { gte: startDate, lte: endDate } },
                            { receivedAt: { gte: startDate, lte: endDate } },
                        ],
                    },
                ],
            },
            select: { id: true, from: true, to: true, cc: true },
        });

        // Additional filtering for to/cc JSON fields
        const results: EmailMatchResult[] = [];

        for (const email of matchingEmails) {
            let isMatch = false;

            // Check from field
            if (emailAddresses.some(addr => email.from.toLowerCase() === addr)) {
                isMatch = true;
            }

            // Check to field (JSON array)
            const toEmails = this.extractEmails(email.to);
            if (toEmails.some(to => emailAddresses.some(addr => to.toLowerCase() === addr))) {
                isMatch = true;
            }

            // Check cc field (JSON array)
            const ccEmails = this.extractEmails(email.cc);
            if (ccEmails.some(cc => emailAddresses.some(addr => cc.toLowerCase() === addr))) {
                isMatch = true;
            }

            if (isMatch) {
                results.push({
                    emailId: email.id,
                    confidenceScore: 95,
                    linkedMethod: 'auto_contact',
                });
            }
        }

        return results;
    }

    /**
     * Find matching emails for a deal using domain-based matching
     */
    private async findEmailsByDomain(
        dealId: number,
        domain: string,
        startDate: Date,
        endDate: Date,
        excludeEmailIds: string[]
    ): Promise<EmailMatchResult[]> {
        const results: EmailMatchResult[] = [];

        // Get all emails in the date range
        const emails = await prisma.email.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            { sentAt: { gte: startDate, lte: endDate } },
                            { receivedAt: { gte: startDate, lte: endDate } },
                        ],
                    },
                    { id: { notIn: excludeEmailIds } },
                ],
            },
            select: { id: true, from: true, to: true },
        });

        for (const email of emails) {
            let isMatch = false;

            // Check from domain
            if (this.emailMatchesDomain(email.from, domain)) {
                isMatch = true;
            }

            // Check to domains
            const toEmails = this.extractEmails(email.to);
            if (toEmails.some(to => this.emailMatchesDomain(to, domain))) {
                isMatch = true;
            }

            if (isMatch) {
                results.push({
                    emailId: email.id,
                    confidenceScore: 70,
                    linkedMethod: 'auto_domain',
                });
            }
        }

        return results;
    }

    /**
     * Find matching emails for a deal using subject line matching
     */
    private async findEmailsBySubject(
        dealId: number,
        dealTitle: string,
        orgName: string | null,
        startDate: Date,
        endDate: Date,
        excludeEmailIds: string[]
    ): Promise<EmailMatchResult[]> {
        const results: EmailMatchResult[] = [];

        if (!dealTitle && !orgName) return results;

        const emails = await prisma.email.findMany({
            where: {
                AND: [
                    {
                        OR: [
                            dealTitle ? { subject: { contains: dealTitle, mode: 'insensitive' } } : {},
                            orgName ? { subject: { contains: orgName, mode: 'insensitive' } } : {},
                        ],
                    },
                    {
                        OR: [
                            { sentAt: { gte: startDate, lte: endDate } },
                            { receivedAt: { gte: startDate, lte: endDate } },
                        ],
                    },
                    { id: { notIn: excludeEmailIds } },
                ],
            },
            select: { id: true },
        });

        return emails.map(email => ({
            emailId: email.id,
            confidenceScore: 60,
            linkedMethod: 'auto_subject' as const,
        }));
    }

    /**
     * Link emails to a specific deal
     */
    async linkEmailsToDeal(
        dealId: number,
        options: {
            useContactMatching?: boolean;
            useDomainMatching?: boolean;
            useSubjectMatching?: boolean;
            daysBefore?: number;
            daysAfter?: number;
        } = {}
    ): Promise<{ linksCreated: number; totalMatches: number }> {
        const {
            useContactMatching = true,
            useDomainMatching = true,
            useSubjectMatching = false, // Disabled by default due to false positives
            daysBefore = 7,
            daysAfter = 7,
        } = options;

        // Get deal information
        const deal = await prisma.deal.findUnique({
            where: { id: dealId },
            include: { organization: true },
        });

        if (!deal) {
            throw new Error(`Deal ${dealId} not found`);
        }

        // Calculate date range
        const dealCreated = deal.createdAt;
        const lastActivity = deal.lastActivityAt || new Date();

        const startDate = new Date(dealCreated);
        startDate.setDate(startDate.getDate() - daysBefore);

        const endDate = new Date(lastActivity);
        endDate.setDate(endDate.getDate() + daysAfter);

        // Update deal status
        await prisma.deal.update({
            where: { id: dealId },
            data: { emailSyncStatus: 'syncing' },
        });

        const allMatches = new Map<string, EmailMatchResult>();

        try {
            // Rule 1: Contact-based matching (highest priority)
            if (useContactMatching) {
                const contactEmails = await this.getContactEmailsForDeal(dealId);
                if (contactEmails.length > 0) {
                    const contactMatches = await this.findEmailsByContact(
                        dealId,
                        contactEmails,
                        startDate,
                        endDate
                    );

                    contactMatches.forEach(match => {
                        allMatches.set(match.emailId, match);
                    });
                }
            }

            // Rule 2: Domain-based matching
            if (useDomainMatching && deal.organization) {
                const domain = this.extractDomain(deal.organization.name);
                if (domain) {
                    const excludeIds = Array.from(allMatches.keys());
                    const domainMatches = await this.findEmailsByDomain(
                        dealId,
                        domain,
                        startDate,
                        endDate,
                        excludeIds
                    );

                    domainMatches.forEach(match => {
                        if (!allMatches.has(match.emailId)) {
                            allMatches.set(match.emailId, match);
                        }
                    });
                }
            }

            // Rule 3: Subject line matching (optional)
            if (useSubjectMatching) {
                const excludeIds = Array.from(allMatches.keys());
                const subjectMatches = await this.findEmailsBySubject(
                    dealId,
                    deal.title,
                    deal.organization?.name || null,
                    startDate,
                    endDate,
                    excludeIds
                );

                subjectMatches.forEach(match => {
                    if (!allMatches.has(match.emailId)) {
                        allMatches.set(match.emailId, match);
                    }
                });
            }

            // Insert all matches into deal_emails table
            const matches = Array.from(allMatches.values());
            let linksCreated = 0;

            for (const match of matches) {
                try {
                    await prisma.dealEmail.upsert({
                        where: {
                            dealId_emailId: {
                                dealId,
                                emailId: match.emailId,
                            },
                        },
                        create: {
                            dealId,
                            emailId: match.emailId,
                            linkedMethod: match.linkedMethod,
                            confidenceScore: match.confidenceScore,
                        },
                        update: {
                            // If already exists, update only if new confidence is higher
                            confidenceScore: match.confidenceScore,
                            linkedMethod: match.linkedMethod,
                        },
                    });

                    // Update email flag
                    await prisma.email.update({
                        where: { id: match.emailId },
                        data: { isLinkedToDeal: true },
                    });

                    linksCreated++;
                } catch (error) {
                    console.error(`Error linking email ${match.emailId} to deal ${dealId}:`, error);
                }
            }

            // Update deal with sync status and count
            await prisma.deal.update({
                where: { id: dealId },
                data: {
                    emailSyncStatus: 'synced',
                    emailLastSyncedAt: new Date(),
                    linkedEmailsCount: linksCreated,
                },
            });

            return {
                linksCreated,
                totalMatches: matches.length,
            };
        } catch (error) {
            // Update deal with failed status
            await prisma.deal.update({
                where: { id: dealId },
                data: { emailSyncStatus: 'failed' },
            });

            throw error;
        }
    }

    /**
     * Bulk link emails to all deals
     */
    async bulkLinkEmails(
        userId: number,
        options: {
            dealIds?: number[];
            useContactMatching?: boolean;
            useDomainMatching?: boolean;
            useSubjectMatching?: boolean;
        } = {}
    ): Promise<{ dealsProcessed: number; totalLinksCreated: number; logId: number }> {
        const { dealIds, ...linkOptions } = options;

        // Create log entry
        const log = await prisma.emailLinkLog.create({
            data: {
                operationType: 'bulk_link',
                status: 'running',
                startedAt: new Date(),
                triggeredByUserId: userId,
                metadata: options,
            },
        });

        try {
            // Get deals to process
            const deals = await prisma.deal.findMany({
                where: dealIds ? { id: { in: dealIds } } : {},
                select: { id: true },
            });

            let dealsProcessed = 0;
            let totalLinksCreated = 0;

            for (const deal of deals) {
                try {
                    const result = await this.linkEmailsToDeal(deal.id, linkOptions);
                    totalLinksCreated += result.linksCreated;
                    dealsProcessed++;

                    // Update log progress
                    await prisma.emailLinkLog.update({
                        where: { id: log.id },
                        data: {
                            dealsProcessed,
                            linksCreated: totalLinksCreated,
                        },
                    });
                } catch (error) {
                    console.error(`Error processing deal ${deal.id}:`, error);
                }
            }

            // Mark log as complete
            await prisma.emailLinkLog.update({
                where: { id: log.id },
                data: {
                    status: 'completed',
                    completedAt: new Date(),
                    dealsProcessed,
                    linksCreated: totalLinksCreated,
                },
            });

            return {
                dealsProcessed,
                totalLinksCreated,
                logId: log.id,
            };
        } catch (error) {
            // Mark log as failed
            await prisma.emailLinkLog.update({
                where: { id: log.id },
                data: {
                    status: 'failed',
                    completedAt: new Date(),
                    errorMessage: error instanceof Error ? error.message : 'Unknown error',
                },
            });

            throw error;
        }
    }

    /**
     * Manually link an email to a deal
     */
    async manuallyLinkEmail(
        dealId: number,
        emailId: string,
        userId: number
    ): Promise<void> {
        await prisma.dealEmail.create({
            data: {
                dealId,
                emailId,
                linkedMethod: 'manual',
                confidenceScore: 100,
                isVerified: true,
                verifiedByUserId: userId,
                verifiedAt: new Date(),
            },
        });

        // Update email flag
        await prisma.email.update({
            where: { id: emailId },
            data: { isLinkedToDeal: true },
        });

        // Update deal count
        const count = await prisma.dealEmail.count({
            where: { dealId },
        });

        await prisma.deal.update({
            where: { id: dealId },
            data: { linkedEmailsCount: count },
        });
    }

    /**
     * Unlink an email from a deal
     */
    async unlinkEmail(dealId: number, emailId: string): Promise<void> {
        await prisma.dealEmail.delete({
            where: {
                dealId_emailId: {
                    dealId,
                    emailId,
                },
            },
        });

        // Check if email is still linked to other deals
        const otherLinks = await prisma.dealEmail.count({
            where: { emailId },
        });

        if (otherLinks === 0) {
            await prisma.email.update({
                where: { id: emailId },
                data: { isLinkedToDeal: false },
            });
        }

        // Update deal count
        const count = await prisma.dealEmail.count({
            where: { dealId },
        });

        await prisma.deal.update({
            where: { id: dealId },
            data: { linkedEmailsCount: count },
        });
    }

    /**
     * Verify a deal-email link
     */
    async verifyLink(
        dealId: number,
        emailId: string,
        userId: number,
        isVerified: boolean = true
    ): Promise<void> {
        await prisma.dealEmail.update({
            where: {
                dealId_emailId: {
                    dealId,
                    emailId,
                },
            },
            data: {
                isVerified,
                verifiedByUserId: userId,
                verifiedAt: new Date(),
            },
        });
    }

    /**
     * Get emails linked to a deal
     */
    async getDealEmails(
        dealId: number,
        options: {
            verifiedOnly?: boolean;
            limit?: number;
            offset?: number;
        } = {}
    ) {
        const { verifiedOnly = false, limit = 50, offset = 0 } = options;

        const where: any = { dealId };
        if (verifiedOnly) {
            where.isVerified = true;
        }

        const [emails, total] = await Promise.all([
            prisma.dealEmail.findMany({
                where,
                include: {
                    email: {
                        select: {
                            id: true,
                            subject: true,
                            from: true,
                            to: true,
                            body: true,
                            snippet: true,
                            sentAt: true,
                            receivedAt: true,
                            isRead: true,
                            attachments: true,
                        },
                    },
                },
                orderBy: {
                    email: {
                        sentAt: 'desc',
                    },
                },
                take: limit,
                skip: offset,
            }),
            prisma.dealEmail.count({ where }),
        ]);

        return {
            emails,
            total,
            hasMore: offset + emails.length < total,
        };
    }
}

export const emailDealLinkingService = new EmailDealLinkingService();
