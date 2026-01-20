import { Response } from 'express';
import { PipelineService } from '../services/pipelineService';
import { PipelineStageService } from '../services/pipelineStageService';
import { AuthenticatedRequest } from '../../../shared/types';
export declare class PipelineController {
    private pipelineService;
    private stageService;
    constructor(pipelineService: PipelineService, stageService: PipelineStageService);
    createPipeline(req: AuthenticatedRequest, res: Response): Promise<void>;
    getPipelines(req: AuthenticatedRequest, res: Response): Promise<void>;
    getPipelineById(req: AuthenticatedRequest, res: Response): Promise<void>;
    updatePipeline(req: AuthenticatedRequest, res: Response): Promise<void>;
    deletePipeline(req: AuthenticatedRequest, res: Response): Promise<void>;
    createStage(req: AuthenticatedRequest, res: Response): Promise<void>;
    getStages(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateStage(req: AuthenticatedRequest, res: Response): Promise<void>;
    reorderStages(req: AuthenticatedRequest, res: Response): Promise<void>;
    deleteStage(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=pipelineController.d.ts.map