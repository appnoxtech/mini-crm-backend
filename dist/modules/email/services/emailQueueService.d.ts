import { EmailService } from './emailService';
import { EmailModel } from '../models/emailModel';
export interface EmailSyncJob {
    accountId: string;
    userId: string;
    priority: 'high' | 'normal' | 'low';
}
export interface EmailSendJob {
    accountId: string;
    emailData: {
        to: string[];
        cc?: string[];
        bcc?: string[];
        subject: string;
        body: string;
        htmlBody?: string;
        attachments?: any[];
    };
}
export declare class EmailQueueService {
    private emailService;
    private emailModel;
    private syncQueue;
    private sendQueue;
    private isProcessing;
    private processingInterval;
    constructor(emailService: EmailService, emailModel: EmailModel);
    private startQueueProcessor;
    private processQueues;
    private processSyncQueue;
    private processSendQueue;
    queueEmailSync(accountId: string, userId: string, priority?: 'high' | 'normal' | 'low'): void;
    queueEmailSend(accountId: string, emailData: EmailSendJob['emailData']): void;
    private scheduleEmailSyncForAllAccounts;
    private getAllActiveAccountsForSync;
    getQueueStatus(): {
        syncQueue: number;
        sendQueue: number;
        isProcessing: boolean;
    };
    stop(): void;
}
//# sourceMappingURL=emailQueueService.d.ts.map