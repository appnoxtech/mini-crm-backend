import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { AuthenticatedRequest } from '../../../shared/types';
import { UserModel } from '../models/User';
export declare class AuthController {
    private authService;
    private userModel;
    constructor(authService: AuthService, userModel: UserModel);
    register(req: Request, res: Response): Promise<void>;
    login(req: Request, res: Response): Promise<void>;
    getProfile(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateProfile(req: AuthenticatedRequest, res: Response): Promise<void>;
    changePassword(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=authController.d.ts.map