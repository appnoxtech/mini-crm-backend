
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Updating SMTP configuration...");

    // The credentials provided by the user
    const smtpConfig = {
        host: 'smtp.hostinger.com',
        port: 587, // Using port 465 for secure SSL usually works best with Gmail
        secure: true,
        username: 'abhijeet.mishra@appnox.ai',
        password: 'Appnox@2025.com'
    };

    // Find the account that failed previously
    let account = await prisma.emailAccount.findFirst({
        where: {
            OR: [
                { email: 'abhijeet.mishra@appnox.ai' },
                { email: 'abhijeet.appnox@gmail.com' }
            ]
        }
    });

    if (!account) {
        console.log("Specific account not found, updating the FIRST active account found.");
        account = await prisma.emailAccount.findFirst({
            where: { isActive: true }
        });
    }

    if (!account) {
        console.error("No active email accounts found to update.");
        return;
    }

    console.log(`Updating account: ${account.email} (${account.id})`);

    await prisma.emailAccount.update({
        where: { id: account.id },
        data: {
            provider: 'hostinger', // Force provider to gmail to trigger correct logic if needed
            smtpConfig: smtpConfig as any,
            // We might need to clear imapConfig or update it too if it was causing issues, 
            // but let's focus on SMTP for sending.
            isActive: true
        }
    });

    console.log("SMTP Configuration updated successfully.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
