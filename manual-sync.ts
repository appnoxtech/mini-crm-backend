import { PrismaClient } from '@prisma/client';
import { EmailService } from './src/modules/email/services/emailService';
import { EmailModel } from './src/modules/email/models/emailModel';
import { EmailConnectorService } from './src/modules/email/services/emailConnectorService';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
    const emailModel = new EmailModel(prisma);
    const connectorService = new EmailConnectorService();
    const emailService = new EmailService(emailModel, connectorService);

    const accounts = await emailModel.getAllActiveAccounts();
    console.log(`Found ${accounts.length} active accounts.`);

    for (const account of accounts) {
        console.log(`Force full syncing ${account.email}...`);
        try {
            // Force full sync by passing a version of account with null lastSyncAt
            const result = await emailService.processIncomingEmails({
                ...account,
                lastSyncAt: null as any
            });
            console.log(`✅ Synced ${result.processed} emails, ${result.newEmails} new, ${result.errors} errors.`);
        } catch (err: any) {
            console.error(`❌ Failed to sync ${account.email}:`, err.message);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
