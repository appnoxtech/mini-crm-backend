import type { Request, Response } from "express";
import { EmailService } from "../services/emailService";
import { OAuthService } from "../services/oauthService";
import { EmailQueueService } from "../services/emailQueueService";
import { RealTimeNotificationService } from "../services/realTimeNotificationService";
import { AuthenticatedRequest } from "../../../shared/types";
export declare class EmailController {
    private emailService;
    private oauthService;
    private queueService;
    private notificationService;
    constructor(emailService: EmailService, oauthService: OAuthService, queueService?: EmailQueueService, notificationService?: RealTimeNotificationService);
    summarizeThread(req: Request, res: Response): Promise<any>;
    getThreadSummary(req: Request, res: Response): Promise<any>;
    sendEmail(req: AuthenticatedRequest, res: Response): Promise<void>;
    private validateAndRefreshTokens;
    validateEmailAccount(req: AuthenticatedRequest, res: Response): Promise<void>;
    getEmailsForContact(req: AuthenticatedRequest, res: Response): Promise<void>;
    getEmailsForDeal(req: AuthenticatedRequest, res: Response): Promise<void>;
    handleEmailOpen(req: Request, res: Response): Promise<void>;
    handleLinkClick(req: Request, res: Response): Promise<void>;
    oauthGmailAuthorize(req: Request, res: Response): Promise<void>;
    oauthOutlookAuthorize(req: Request, res: Response): Promise<void>;
    oauthGmailStatus(req: Request, res: Response): Promise<void>;
    oauthOutlookStatus(req: Request, res: Response): Promise<void>;
    oauthGmailCallback(req: Request, res: Response): Promise<void>;
    oauthOutlookCallback(req: Request, res: Response): Promise<void>;
    getEmailAccounts(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Test SMTP and/or IMAP connection before saving account
     * This allows users to validate credentials before committing to an account
     */
    testConnection(req: AuthenticatedRequest, res: Response): Promise<void>;
    connectEmailAccount(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateEmailAccount(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Delete (deactivate) an email account
     * Performs soft delete by setting isActive = false
     */
    deleteEmailAccount(req: AuthenticatedRequest, res: Response): Promise<void>;
    triggerEmailSync(req: AuthenticatedRequest, res: Response): Promise<void>;
    getQueueStatus(req: AuthenticatedRequest, res: Response): Promise<void>;
    getNotificationStats(req: AuthenticatedRequest, res: Response): Promise<void>;
    getEmails(req: AuthenticatedRequest, res: Response): Promise<void>;
    getInbox(req: AuthenticatedRequest, res: Response): Promise<void>;
    getSent(req: AuthenticatedRequest, res: Response): Promise<void>;
    getDrafts(req: AuthenticatedRequest, res: Response): Promise<void>;
    getSpam(req: AuthenticatedRequest, res: Response): Promise<void>;
    getTrash(req: AuthenticatedRequest, res: Response): Promise<void>;
    getEmailById(req: AuthenticatedRequest, res: Response): Promise<void>;
    markEmailAsRead(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=emailController.d.ts.map