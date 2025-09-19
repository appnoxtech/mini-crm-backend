import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authMiddleware } from '../../../shared/middleware/auth';

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  // Public routes
  router.post('/register', (req, res) => authController.register(req, res));
  router.post('/login', (req, res) => authController.login(req, res));

  // Protected routes
  (router as any).get('/profile', authMiddleware, (req: any, res: any) => authController.getProfile(req, res));
  (router as any).put('/profile', authMiddleware, (req: any, res: any) => authController.updateProfile(req, res));
  (router as any).put('/change-password', authMiddleware, (req: any, res: any) => authController.changePassword(req, res));

  return router;
}
