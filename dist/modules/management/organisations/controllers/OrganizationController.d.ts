import { Response } from 'express';
import { OrganizationService } from '../services/OrganizationService';
import { AuthenticatedRequest } from '../../../../shared/types';
export declare class OrganizationController {
    private organizationService;
    constructor(organizationService: OrganizationService);
    getAll(req: AuthenticatedRequest, res: Response): Promise<void>;
    getById(req: AuthenticatedRequest, res: Response): Promise<void>;
    create(req: AuthenticatedRequest, res: Response): Promise<void>;
    update(req: AuthenticatedRequest, res: Response): Promise<void>;
    delete(req: AuthenticatedRequest, res: Response): Promise<void>;
    searchByOrgName(req: AuthenticatedRequest, res: Response): Promise<void>;
    restore(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=OrganizationController.d.ts.map