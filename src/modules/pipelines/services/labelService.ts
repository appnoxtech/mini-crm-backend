import { Label, LabelModel } from '../models/Label';

export class LabelService {
    constructor(private labelModel: LabelModel) { }

    async createlabel(userId: number, data: Label): Promise<Label> {
        if (!data.value || !data.value.trim()) {
            throw new Error('label value is required');
        }
        if (!data.color) {
            throw new Error('Color is required');
        }
        if (data.orderIndex === undefined) {
            throw new Error('Order index is required');
        }

        return this.labelModel.create({
            value: data.value.trim(),
            color: data.color,
            orderIndex: data.orderIndex,
            pipelineId: data.pipelineId,
            organizationId: data.organizationId,
            personId: data.personId,
            userId
        });
    }

    async getlabels(userId: number, filters: {
        pipelineId?: number;
        search?: string;
        limit?: number;
        page?: number;
    } = {}): Promise<{ labels: Label[]; total: number; pagination: any }> {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        const result = await this.labelModel.findByUserId(userId, {
            ...filters,
            limit,
            offset
        });

        return {
            labels: result.label, // Note: Model returns 'label' property
            total: result.total,
            pagination: {
                total: result.total,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit)
            }
        };
    }

    async getlabelByPipelineId(pipelineId: number, userId: number): Promise<Label[] | null> {
        const label = await this.labelModel.findByPipelineId(pipelineId);
        if (!label) {
            return null;
        }
        return label;
    }

    async getlabelByOrganizationId(organizationId: number, userId: number): Promise<Label[] | null> {
        const label = await this.labelModel.findByOrganizationId(organizationId);
        if (!label) {
            return null;
        }
        return label;
    }

    async getlabelByPersonId(personId: number, userId: number): Promise<Label[] | null> {
        const label = await this.labelModel.findByPersonId(personId);
        if (!label) {
            return null;
        }
        return label;
    }

    async updatelabel(labelId: number, data: Partial<Label>): Promise<Label | null> {
        const label = await this.labelModel.findById(labelId);
        if (!label) {
            return null;
        }

        return (await this.labelModel.update(labelId, data)) || null;
    }

    async deletelabel(labelId: number): Promise<boolean> {
        const label = await this.labelModel.findById(labelId);
        if (!label) {
            return false;
        }
        return await this.labelModel.delete(labelId);
    }
}
