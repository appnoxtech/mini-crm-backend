import { Lavel, LavelModel } from '../models/Lavel';

export class LavelService {
    constructor(private lavelModel: LavelModel) { }

    async createLavel(userId: number, data: {
        value: string;
        color: string;
        orderIndex: number;
        pipelineId: number;
    }): Promise<Lavel> {
        if (!data.value || !data.value.trim()) {
            throw new Error('Lavel value is required');
        }
        if (!data.color) {
            throw new Error('Color is required');
        }
        if (data.orderIndex === undefined) {
            throw new Error('Order index is required');
        }
        if (!data.pipelineId) {
            throw new Error('Pipeline ID is required');
        }

        return this.lavelModel.create({
            value: data.value.trim(),
            color: data.color,
            orderIndex: data.orderIndex,
            pipelineId: data.pipelineId,
            userId
        });
    }

    async getLavels(userId: number, filters: {
        pipelineId?: number;
        search?: string;
        limit?: number;
        page?: number;
    } = {}): Promise<{ lavels: Lavel[]; total: number; pagination: any }> {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        const result = this.lavelModel.findByUserId(userId, {
            ...filters,
            limit,
            offset
        });

        return {
            lavels: result.lavel, // Note: Model returns 'lavel' property
            total: result.total,
            pagination: {
                total: result.total,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit)
            }
        };
    }

    async getLavelByPipelineId(pipelineId: number, userId: number): Promise<Lavel[] | null> {
        const lavel = this.lavelModel.findByPipelineId(pipelineId);
        if (!lavel) {
            return null;
        }
        return lavel;
    }

    async updateLavel(lavelId: number, data: Partial<Lavel>): Promise<Lavel | null> {
        const lavel = this.lavelModel.findById(lavelId);
        if (!lavel) {
            return null;
        }

        return this.lavelModel.update(lavelId, data) || null;
    }

    async deleteLavel(lavelId: number): Promise<boolean> {
        const lavel = this.lavelModel.findById(lavelId);
        if (!lavel) {
            return false;
        }
        return this.lavelModel.delete(lavelId);
    }
}
