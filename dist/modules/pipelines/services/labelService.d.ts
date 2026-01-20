import { Label, LabelModel } from '../models/Label';
export declare class LabelService {
    private labelModel;
    constructor(labelModel: LabelModel);
    createlabel(userId: number, data: Label): Promise<Label>;
    getlabels(userId: number, filters?: {
        pipelineId?: number;
        search?: string;
        limit?: number;
        page?: number;
    }): Promise<{
        labels: Label[];
        total: number;
        pagination: any;
    }>;
    getlabelByPipelineId(pipelineId: number, userId: number): Promise<Label[] | null>;
    getlabelByOrganizationId(organizationId: number, userId: number): Promise<Label[] | null>;
    getlabelByPersonId(personId: number, userId: number): Promise<Label[] | null>;
    updatelabel(labelId: number, data: Partial<Label>): Promise<Label | null>;
    deletelabel(labelId: number): Promise<boolean>;
}
//# sourceMappingURL=labelService.d.ts.map