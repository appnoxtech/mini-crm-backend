import { Router } from 'express';
import { InvitationController } from '../controllers/invitationController';
import { authMiddleware } from '../../../shared/middleware/auth';
import { rateLimiter } from '../../../shared/middleware/rateLimiter';

export function createInvitationRoutes(invitationController: InvitationController): Router {
    const router = Router();

    // Public routes
    router.get('/verify', (req, res) => invitationController.verifyToken(req, res));
    router.post('/accept',
        rateLimiter(15 * 60 * 1000, 5), // 5 attempts per 15 mins for security
        (req, res) => invitationController.acceptInvitation(req, res)
    );

    // Protected routes
    router.post('/invite',
        authMiddleware,
        rateLimiter(60 * 60 * 1000, 50), // 50 invites per hour per admin
        (req: any, res: any) => invitationController.inviteUsers(req, res)
    );
    router.get('/', authMiddleware, (req: any, res: any) => invitationController.getInvitations(req, res));
    router.delete('/:id', authMiddleware, (req: any, res: any) => invitationController.revokeInvitation(req, res));

    return router;
}
