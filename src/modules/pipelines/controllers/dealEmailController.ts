/**
 * Deal Email Controller
 * 
 * Handles HTTP requests for email-deal linking functionality
 */

import { Request, Response } from 'express';
import { emailDealLinkingService } from '../services/emailDealLinkingService';

export class DealEmailController {
    /**
     * GET /api/deals/:dealId/emails
     * Get all emails linked to a deal
     */
    async getDealEmails(req: Request, res: Response) {
        try {
            const dealId = parseInt(req.params.dealId!);
            const verifiedOnly = req.query.verified_only === 'true';
            const limit = parseInt(req.query.limit as string) || 50;
            const offset = parseInt(req.query.offset as string) || 0;

            const result = await emailDealLinkingService.getDealEmails(dealId, {
                verifiedOnly,
                limit,
                offset,
            });

            res.json({
                success: true,
                data: {
                    dealId,
                    total: result.total,
                    hasMore: result.hasMore,
                    emails: result.emails.map((de: any) => ({
                        id: de.email.id,
                        subject: de.email.subject,
                        from: de.email.from,
                        to: de.email.to,
                        snippet: de.email.snippet || de.email.body.substring(0, 150),
                        sentAt: de.email.sentAt,
                        receivedAt: de.email.receivedAt,
                        isRead: de.email.isRead,
                        hasAttachments: de.email.attachments ? true : false,
                        linkedMethod: de.linkedMethod,
                        confidenceScore: de.confidenceScore,
                        isVerified: de.isVerified,
                        linkedAt: de.linkedAt,
                    })),
                },
            });
        } catch (error) {
            console.error('Error fetching deal emails:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch deal emails',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * GET /api/emails/:emailId
     * Get full email details
     */
    async getEmailDetails(req: Request, res: Response) {
        try {
            const { PrismaClient } = require('@prisma/client');
            const prisma = new PrismaClient();

            const emailId = req.params.emailId;

            const email = await prisma.email.findUnique({
                where: { id: emailId },
                include: {
                    account: {
                        select: {
                            email: true,
                            provider: true,
                        },
                    },
                    dealLinks: {
                        include: {
                            deal: {
                                select: {
                                    id: true,
                                    title: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!email) {
                return res.status(404).json({
                    success: false,
                    error: 'Email not found',
                });
            }

            res.json({
                success: true,
                data: email,
            });
        } catch (error) {
            console.error('Error fetching email details:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch email details',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * POST /api/deals/:dealId/emails/sync
     * Sync/link emails for a specific deal
     */
    async syncDealEmails(req: Request, res: Response) {
        try {
            const dealId = parseInt(req.params.dealId!);
            const {
                useContactMatching = true,
                useDomainMatching = true,
                useSubjectMatching = false,
            } = req.body;

            const result = await emailDealLinkingService.linkEmailsToDeal(dealId, {
                useContactMatching,
                useDomainMatching,
                useSubjectMatching,
            });

            res.json({
                success: true,
                data: {
                    dealId,
                    linksCreated: result.linksCreated,
                    totalMatches: result.totalMatches,
                },
                message: `Successfully linked ${result.linksCreated} emails to deal`,
            });
        } catch (error) {
            console.error('Error syncing deal emails:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to sync emails',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * POST /api/deals/:dealId/emails/link
     * Manually link an email to a deal
     */
    async linkEmail(req: Request, res: Response) {
        try {
            const dealId = parseInt(req.params.dealId!);
            const { emailId } = req.body;
            const userId = (req as any).user?.id || 1; // Get from auth middleware

            if (!emailId) {
                return res.status(400).json({
                    success: false,
                    error: 'emailId is required',
                });
            }

            await emailDealLinkingService.manuallyLinkEmail(dealId, emailId, userId);

            res.json({
                success: true,
                message: 'Email linked successfully',
            });
        } catch (error) {
            console.error('Error linking email:', error);

            if (error instanceof Error && error.message.includes('Unique constraint')) {
                return res.status(409).json({
                    success: false,
                    error: 'Email is already linked to this deal',
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to link email',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * DELETE /api/deals/:dealId/emails/:emailId
     * Unlink an email from a deal
     */
    async unlinkEmail(req: Request, res: Response) {
        try {
            const dealId = parseInt(req.params.dealId!);
            const emailId = req.params.emailId!;

            await emailDealLinkingService.unlinkEmail(dealId, emailId);

            res.json({
                success: true,
                message: 'Email unlinked successfully',
            });
        } catch (error) {
            console.error('Error unlinking email:', error);

            if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
                return res.status(404).json({
                    success: false,
                    error: 'Email link not found',
                });
            }

            res.status(500).json({
                success: false,
                error: 'Failed to unlink email',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * PUT /api/deal-emails/:dealId/:emailId/verify
     * Verify or unverify a deal-email link
     */
    async verifyLink(req: Request, res: Response) {
        try {
            const dealId = parseInt(req.params.dealId!);
            const emailId = req.params.emailId!;
            const { verified = true } = req.body;
            const userId = (req as any).user?.id || 1; // Get from auth middleware

            await emailDealLinkingService.verifyLink(dealId, emailId, userId, verified);

            res.json({
                success: true,
                message: verified ? 'Link verified successfully' : 'Link unverified successfully',
            });
        } catch (error) {
            console.error('Error verifying link:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to verify link',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * POST /api/deals/emails/bulk-sync
     * Bulk sync emails for multiple deals
     */
    async bulkSyncEmails(req: Request, res: Response) {
        try {
            const {
                dealIds,
                useContactMatching = true,
                useDomainMatching = true,
                useSubjectMatching = false,
            } = req.body;

            const userId = (req as any).user?.id || 1; // Get from auth middleware

            const result = await emailDealLinkingService.bulkLinkEmails(userId, {
                dealIds,
                useContactMatching,
                useDomainMatching,
                useSubjectMatching,
            });

            res.json({
                success: true,
                data: result,
                message: `Successfully processed ${result.dealsProcessed} deals and created ${result.totalLinksCreated} links`,
            });
        } catch (error) {
            console.error('Error in bulk sync:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to bulk sync emails',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * GET /api/email-link-logs
     * Get bulk sync operation logs
     */
    async getLinkLogs(req: Request, res: Response) {
        try {
            const { PrismaClient } = require('@prisma/client');
            const prisma = new PrismaClient();

            const limit = parseInt(req.query.limit as string) || 20;
            const offset = parseInt(req.query.offset as string) || 0;

            const [logs, total] = await Promise.all([
                prisma.emailLinkLog.findMany({
                    orderBy: { startedAt: 'desc' },
                    take: limit,
                    skip: offset,
                    include: {
                        triggeredBy: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                    },
                }),
                prisma.emailLinkLog.count(),
            ]);

            res.json({
                success: true,
                data: {
                    logs,
                    total,
                    hasMore: offset + logs.length < total,
                },
            });
        } catch (error) {
            console.error('Error fetching link logs:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch link logs',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
}

export const dealEmailController = new DealEmailController();
