import nodemailer from 'nodemailer';

export class SystemEmailHelper {
    /**
     * Send email using the system-wide SMTP configuration from .env
     */
    static async sendViaSystemSmtp(to: string, subject: string, text: string, html?: string): Promise<boolean> {
        const smtpHost = process.env.SMTP_HOST;
        const smtpPort = parseInt(process.env.SMTP_PORT || '587');
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;
        const smtpSecure = process.env.SMTP_SECURE === 'true';

        if (!smtpHost || !smtpUser || !smtpPass) {
            console.warn('⚠️ System SMTP not configured in .env. Skipping email notification.');
            return false;
        }

        try {
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpSecure, // true for 465, false for other ports
                auth: {
                    user: smtpUser,
                    pass: smtpPass,
                },
            });

            await transporter.sendMail({
                from: `"CRM System" <${smtpUser}>`,
                to,
                subject,
                text,
                html,
            });

            console.log(`📧 System email sent to ${to}`);
            return true;
        } catch (error) {
            console.error('Failed to send system email:', error);
            return false;
        }
    }
}
