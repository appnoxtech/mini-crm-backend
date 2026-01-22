import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authMiddleware } from '../../../shared/middleware/auth';
import { registerSchema, loginSchema, changePasswordSchema } from '../validation/authValidation';
import validate from '../../../shared/validate';


export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  // Public routes
  router.post('/register', validate(registerSchema), (req, res) => authController.register(req, res));
  router.post('/login', validate(loginSchema), (req, res) => authController.login(req, res));

  // Protected routes
  router.get('/profile', authMiddleware, (req: any, res: any) => authController.getProfile(req, res));
  router.put('/profile', authMiddleware, (req: any, res: any) => authController.updateProfile(req, res));
  router.put('/change-password', authMiddleware, validate(changePasswordSchema), (req: any, res: any) => authController.changePassword(req, res));


  // role routes
  router.put('/change-account-role', authMiddleware, (req: any, res: any) => authController.changeAccountRole(req, res));

  return router;
}
