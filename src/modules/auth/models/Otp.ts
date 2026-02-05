import { prisma } from '../../../shared/prisma';

export class OtpModel {
    constructor() { }

    initialize(): void { }

    async saveOtp(email: string, otp: string, expiresAt: Date): Promise<void> {
        const emailLower = email.toLowerCase();

        // Find existing OTP for this email
        const existing = await prisma.otp.findFirst({
            where: { email: emailLower }
        });

        if (existing) {
            await prisma.otp.update({
                where: { id: existing.id },
                data: {
                    otp,
                    expiresAt,
                    createdAt: new Date()
                }
            });
        } else {
            await prisma.otp.create({
                data: {
                    email: emailLower,
                    otp,
                    expiresAt
                }
            });
        }
    }

    async getOtp(email: string): Promise<{ otp: string; expiresAt: string } | undefined> {
        const otp = await prisma.otp.findFirst({
            where: { email: email.toLowerCase() },
            orderBy: { createdAt: 'desc' }
        });

        if (!otp) return undefined;

        return {
            otp: otp.otp,
            expiresAt: otp.expiresAt.toISOString()
        };
    }

    async deleteOtp(email: string): Promise<void> {
        await prisma.otp.deleteMany({
            where: { email: email.toLowerCase() }
        });
    }

    async cleanupExpired(): Promise<void> {
        await prisma.otp.deleteMany({
            where: {
                expiresAt: {
                    lt: new Date()
                }
            }
        });
    }
}
