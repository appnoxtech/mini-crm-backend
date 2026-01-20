import { Response } from 'express';
import { LabelService } from '../services/labelService';
import { AuthenticatedRequest } from '../../../shared/types';
export declare class LabelController {
    private labelService;
    constructor(labelService: LabelService);
    create: (req: AuthenticatedRequest, res: Response) => Promise<any>;
    getAll: (req: AuthenticatedRequest, res: Response) => Promise<any>;
    getAllByPipelineId: (req: AuthenticatedRequest, res: Response) => Promise<any>;
    getAllByOrganizationId: (req: AuthenticatedRequest, res: Response) => Promise<any>;
    getAllByPersonId: (req: AuthenticatedRequest, res: Response) => Promise<any>;
    update: (req: AuthenticatedRequest, res: Response) => Promise<any>;
    delete: (req: AuthenticatedRequest, res: Response) => Promise<any>;
}
//# sourceMappingURL=labelController.d.ts.map