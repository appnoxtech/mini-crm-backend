import { Response } from 'express';
import { ProfileService } from '../services/profileService';
import { AuthenticatedRequest } from '../../../../shared/types';
export declare class ProfileController {
    private profileService;
    constructor(profileService: ProfileService);
    getProfile(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateProfile(req: AuthenticatedRequest, res: Response): Promise<void>;
    deleteProfile(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=profileController.d.ts.map