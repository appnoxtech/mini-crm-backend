import { Pipeline, PipelineModel } from '../models/Pipeline';
import { PipelineStageModel } from '../models/PipelineStage';
export declare class PipelineService {
    private pipelineModel;
    private stageModel;
    constructor(pipelineModel: PipelineModel, stageModel: PipelineStageModel);
    createPipeline(userId: number, data: {
        name: string;
        description?: string;
        isDefault?: boolean;
        dealRotting?: boolean;
        rottenDays?: number;
        stagesData?: Array<{
            name: string;
            probability: number;
            orderIndex: number;
        }>;
    }): Promise<Pipeline>;
    getPipelines(userId: number, includeStages?: boolean, includeInactive?: boolean): Promise<any[]>;
    getPipelineById(id: number, userId: number): Promise<any | null>;
    updatePipeline(id: number, userId: number, data: {
        name?: string;
        description?: string;
        isDefault?: boolean;
        isActive?: boolean;
        dealRotting?: boolean;
        rottenDays?: number;
        stagesData?: Array<{
            stageId?: number | null;
            name: string;
            orderIndex: number;
            probability?: number;
            rottenDays?: number;
        }>;
        deletedStagesIds?: Array<{
            stageId: number;
            moveDealsToStageId: number;
        }>;
    }): Promise<Pipeline | null>;
    deletePipeline(id: number, userId: number): Promise<{
        success: boolean;
        dealsAffected: number;
    }>;
    getDefaultPipeline(userId: number): Promise<Pipeline | null>;
}
//# sourceMappingURL=pipelineService.d.ts.map