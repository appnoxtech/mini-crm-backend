import { PipelineStage, PipelineStageModel } from '../models/PipelineStage';
import { PipelineModel } from '../models/Pipeline';
export declare class PipelineStageService {
    private stageModel;
    private pipelineModel;
    constructor(stageModel: PipelineStageModel, pipelineModel: PipelineModel);
    createStage(pipelineId: number, userId: number, data: {
        name: string;
        orderIndex?: number;
        probability?: number;
        rottenDays?: number;
    }): Promise<PipelineStage>;
    getStages(pipelineId: number, userId: number): Promise<any[]>;
    updateStage(pipelineId: number, stageId: number, userId: number, data: {
        name?: string;
        probability?: number;
        rottenDays?: number;
    }): Promise<PipelineStage | null>;
    reorderStages(pipelineId: number, userId: number, stageOrder: number[]): Promise<PipelineStage[]>;
    deleteStage(pipelineId: number, stageId: number, userId: number, moveDealsToStageId?: number): Promise<{
        success: boolean;
        dealsMoved: number;
    }>;
}
//# sourceMappingURL=pipelineStageService.d.ts.map