import { Router, Request, Response } from 'express';
import { ProfileController } from '../controllers/profileController';
import { authMiddleware } from '../../../../shared/middleware/auth';
import { fileUploadMiddleware } from '../../../../shared/middleware/fileUpload';

export function createProfileRoutes(profileController: ProfileController): Router {
    const router = Router();

    // Apply auth middleware to all routes
    router.use(authMiddleware);

    // Profile operations (relative to the authenticated user)
    router.get('/user', (req, res) => profileController.getProfile(req, res));
    router.put('/update', fileUploadMiddleware, (req: Request, res: Response) => profileController.updateProfile(req, res));
    router.delete('/delete', (req, res) => profileController.deleteProfile(req, res));

    return router;
}
