import { Response } from 'express';
import { AuthenticatedRequest } from '../../../shared/types';
import { InvitationService } from '../services/invitationService';
import { ResponseHandler } from '../../../shared/responses/responses';
import { inviteUserSchema, acceptInvitationSchema } from '../validation/invitationValidation';
import bcrypt from 'bcryptjs';

export class InvitationController {
    private invitationService: InvitationService;

    constructor(invitationService: InvitationService) {
        this.invitationService = invitationService;
    }

    /**
     * Invite users (Admin only)
     */
    async inviteUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) return ResponseHandler.unauthorized(res);

            // Check if user is admin (permission validation)
            if (req.user.role !== 'admin') {
                return ResponseHandler.forbidden(res, 'Only admins can invite users');
            }

            const validation = inviteUserSchema.safeParse(req.body);
            if (!validation.success) {
                return ResponseHandler.validationError(res, validation.error.format());
            }

            const { emails, role } = validation.data;
            const ipAddress = req.ip;
            const userAgent = req.get('user-agent');

            const results = await this.invitationService.inviteUsers(
                emails,
                role,
                req.user.companyId,
                req.user.id,
                ipAddress,
                userAgent
            );

            const successCount = results.filter(r => r.status === 'success').length;
            const totalCount = results.length;

            return ResponseHandler.success(res, {
                results,
                summary: {
                    total: totalCount,
                    success: successCount,
                    failed: totalCount - successCount
                }
            }, `Invited ${successCount} user(s) successfully`);
        } catch (error: any) {
            console.error('Invite users error:', error);
            return ResponseHandler.internalError(res, error.message);
        }
    }

    /**
     * Get all invitations for the company
     */
    async getInvitations(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) return ResponseHandler.unauthorized(res);

            const invitations = await this.invitationService.getCompanyInvitations(req.user.companyId);
            return ResponseHandler.success(res, invitations);
        } catch (error: any) {
            return ResponseHandler.internalError(res, error.message);
        }
    }

    /**
     * Accept invitation
     */
    async acceptInvitation(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const validation = acceptInvitationSchema.safeParse(req.body);
            if (!validation.success) {
                return ResponseHandler.validationError(res, validation.error.format());
            }

            const { token, password, name, phone } = validation.data;
            const passwordHash = await bcrypt.hash(password, 10);
            const ipAddress = req.ip;
            const userAgent = req.get('user-agent');

            const user = await this.invitationService.acceptInvitation(
                token,
                { name, passwordHash, phone },
                ipAddress,
                userAgent
            );

            return ResponseHandler.created(res, {
                id: user.id,
                email: user.email,
                name: user.name
            }, 'Invitation accepted successfully. You can now log in.');
        } catch (error: any) {
            console.error('Accept invitation error:', error);
            return ResponseHandler.badRequest(res, error.message);
        }
    }

    /**
     * Verify token (for frontend to check if link is valid)
     */
    async verifyToken(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { token } = req.query;
            if (!token || typeof token !== 'string') {
                return ResponseHandler.validationError(res, 'Token is required');
            }

            const result = await this.invitationService.verifyToken(token);
            if (!result.valid) {
                return ResponseHandler.badRequest(res, result.message);
            }

            return ResponseHandler.success(res, {
                valid: true,
                invitation: {
                    email: result.invitation?.email,
                    companyName: result.invitation?.company?.name,
                    role: result.invitation?.role
                }
            });
        } catch (error: any) {
            return ResponseHandler.internalError(res, error.message);
        }
    }

    /**
     * Revoke invitation
     */
    async revokeInvitation(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) return ResponseHandler.unauthorized(res);
            if (req.user.role !== 'admin') {
                return ResponseHandler.forbidden(res, 'Only admins can revoke invitations');
            }

            const { id } = req.params;
            await this.invitationService.revokeInvitation(id, req.user.companyId, req.user.id);

            return ResponseHandler.success(res, null, 'Invitation revoked successfully');
        } catch (error: any) {
            return ResponseHandler.badRequest(res, error.message);
        }
    }
}
