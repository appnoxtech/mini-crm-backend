import { prisma } from '../../../shared/prisma';
import crypto from 'crypto';
import { SystemEmailHelper } from '../../../shared/utils/SystemEmailHelper';
import { invitationEmailTemplate } from '../templates/invitationEmail';

export interface BatchInvitationResult {
    email: string;
    status: 'success' | 'failed';
    message: string;
}

export class InvitationService {
    /**
     * Invite a batch of users
     */
    async inviteUsers(
        emails: string[],
        role: string,
        companyId: number,
        invitedBy: number,
        ipAddress?: string,
        userAgent?: string
    ): Promise<BatchInvitationResult[]> {
        const results: BatchInvitationResult[] = [];

        // Get company details for branding
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { name: true }
        });

        if (!company) {
            throw new Error('Company not found');
        }

        for (const email of emails) {
            try {
                const normalizedEmail = email.toLowerCase();

                // 1. Check if user already exists in this company
                const existingUser = await prisma.user.findFirst({
                    where: { email: normalizedEmail, companyId }
                });

                if (existingUser) {
                    results.push({ email, status: 'failed', message: 'User already a member of this company' });
                    continue;
                }

                // 2. Check for existing pending invitation
                const existingInvite = await prisma.userInvitation.findFirst({
                    where: { email: normalizedEmail, companyId, status: 'PENDING' }
                });

                if (existingInvite && existingInvite.expiresAt > new Date()) {
                    results.push({ email, status: 'failed', message: 'Pending invitation already exists' });
                    continue;
                }

                // 3. Generate secure token
                const token = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

                // 4. Create or update invitation
                const invitation = await prisma.userInvitation.upsert({
                    where: {
                        email_companyId_status: {
                            email: normalizedEmail,
                            companyId,
                            status: 'PENDING'
                        }
                    },
                    update: {
                        token,
                        role,
                        invitedBy,
                        expiresAt,
                        status: 'PENDING'
                    },
                    create: {
                        email: normalizedEmail,
                        token,
                        companyId,
                        role,
                        invitedBy,
                        expiresAt,
                        status: 'PENDING'
                    }
                });

                // 5. Send Email
                const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invitation?token=${token}`;
                const { html, text } = invitationEmailTemplate(company.name, inviteUrl);

                const emailSent = await SystemEmailHelper.sendViaSystemSmtp(
                    normalizedEmail,
                    `Invitation to join ${company.name} on CRM`,
                    text,
                    html
                );

                if (!emailSent) {
                    // If email fails, we might want to log it or mark invite as failed
                    results.push({ email, status: 'failed', message: 'Failed to send invitation email' });
                    continue;
                }

                // 6. Audit Log
                await prisma.auditLog.create({
                    data: {
                        companyId,
                        userId: invitedBy,
                        action: 'USER_INVITED',
                        entityType: 'UserInvitation',
                        entityId: invitation.id,
                        metadata: { email: normalizedEmail, role },
                        ipAddress,
                        userAgent
                    }
                });

                results.push({ email, status: 'success', message: 'Invitation sent successfully' });
            } catch (error: any) {
                console.error(`Error inviting ${email}:`, error);
                results.push({ email, status: 'failed', message: error.message || 'Internal error' });
            }
        }

        return results;
    }

    /**
     * Verify an invitation token
     */
    async verifyToken(token: string) {
        const invitation = await prisma.userInvitation.findUnique({
            where: { token },
            include: { company: { select: { name: true } } }
        });

        if (!invitation) {
            return { valid: false, message: 'Invalid token' };
        }

        if (invitation.status !== 'PENDING') {
            return { valid: false, message: `Invitation already ${invitation.status.toLowerCase()}` };
        }

        if (invitation.expiresAt < new Date()) {
            // Update status to EXPIRED
            await prisma.userInvitation.update({
                where: { id: invitation.id },
                data: { status: 'EXPIRED' }
            });
            return { valid: false, message: 'Invitation expired' };
        }

        return { valid: true, invitation };
    }

    /**
     * Accept an invitation and create a user
     */
    async acceptInvitation(
        token: string,
        userData: { name: string; passwordHash: string; phone?: string },
        ipAddress?: string,
        userAgent?: string
    ) {
        const verification = await this.verifyToken(token);
        if (!verification.valid || !verification.invitation) {
            throw new Error(verification.message);
        }

        const { invitation } = verification;

        // Transaction to create user and update invitation
        return await prisma.$transaction(async (tx) => {
            // 1. Create user
            const user = await tx.user.create({
                data: {
                    email: invitation.email,
                    name: userData.name,
                    passwordHash: userData.passwordHash,
                    phone: userData.phone,
                    role: invitation.role,
                    companyId: invitation.companyId
                }
            });

            // 2. Update invitation status
            await tx.userInvitation.update({
                where: { id: invitation.id },
                data: { status: 'ACCEPTED' }
            });

            // 3. Audit Log
            await tx.auditLog.create({
                data: {
                    companyId: invitation.companyId,
                    userId: user.id,
                    action: 'INVITATION_ACCEPTED',
                    entityType: 'UserInvitation',
                    entityId: invitation.id,
                    metadata: { email: invitation.email },
                    ipAddress,
                    userAgent
                }
            });

            return user;
        });
    }

    /**
     * Get invitations for a company
     */
    async getCompanyInvitations(companyId: number) {
        return await prisma.userInvitation.findMany({
            where: { companyId },
            orderBy: { createdAt: 'desc' },
            include: {
                inviter: {
                    select: { id: true, name: true, email: true }
                }
            }
        });
    }

    /**
     * Revoke an invitation
     */
    async revokeInvitation(invitationId: string, companyId: number, revokedBy: number) {
        const invitation = await prisma.userInvitation.findFirst({
            where: { id: invitationId, companyId, status: 'PENDING' }
        });

        if (!invitation) {
            throw new Error('Invitation not found or cannot be revoked');
        }

        await prisma.userInvitation.update({
            where: { id: invitationId },
            data: { status: 'REVOKED' }
        });

        // Audit Log
        await prisma.auditLog.create({
            data: {
                companyId,
                userId: revokedBy,
                action: 'INVITATION_REVOKED',
                entityType: 'UserInvitation',
                entityId: invitationId,
                metadata: { email: invitation.email }
            }
        });

        return true;
    }
}
