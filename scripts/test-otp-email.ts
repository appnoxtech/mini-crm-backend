import dotenv from 'dotenv';
import { EmailService } from '../src/modules/email/services/emailService';

// Load env vars
dotenv.config();

// Mock dependencies
const mockEmailModel: any = {};
const mockConnectorService: any = {
    sendEmail: async () => 'mock-message-id'
};

const emailService = new EmailService(
    mockEmailModel,
    mockConnectorService
);

async function testSystemEmail() {
    console.log('Testing System Email...');
    const targetEmail = process.env.SMTP_USER || 'dev@appnox.ai'; // Send to self
    console.log(`Sending to: ${targetEmail}`);

    // Create a temporary system account from .env
    const systemAccount: any = {
        id: 'system',
        userId: 'system',
        email: process.env.SMTP_USER || 'system@appnox.ai',
        provider: 'custom',
        isActive: true,
        smtpConfig: {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            username: process.env.SMTP_USER || '',
            password: process.env.SMTP_PASS || ''
        }
    };

    try {
        const result = await emailService.sendEmail(
            systemAccount,
            {
                to: [targetEmail],
                subject: 'Test OTP System Email',
                body: 'This is a test email',
                htmlBody: '<h1>This is a test email</h1><p>If you see this, system email configuration works.</p>'
            },
            { skipSave: true }
        );
        console.log(`✅ System email sent successfully, Message ID: ${result}`);
    } catch (error) {
        console.error('❌ Failed to send system email:', error);
    }
}

testSystemEmail().catch(console.error);
