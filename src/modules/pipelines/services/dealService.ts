import { Deal, DealModel } from '../models/Deal';
import { DealHistoryModel } from '../models/DealHistory';
import { PipelineModel } from '../models/Pipeline';
import { PipelineStageModel } from '../models/PipelineStage';

export class DealService {
    constructor(
        private dealModel: DealModel,
        private historyModel: DealHistoryModel,
        private pipelineModel: PipelineModel,
        private stageModel: PipelineStageModel
    ) { }

    async createDeal(userId: number, data: {
        title: string;
        pipelineId: number;
        stageId: number;
        value?: number;
        currency?: string;
        personName?: string;
        organizationName?: string;
        email?: string;
        phone?: string;
        description?: string;
        expectedCloseDate?: string;
        probability?: number;
        assignedTo?: number;
        source?: string;
        labels?: string[];
        customFields?: Record<string, any>;
    }): Promise<Deal> {
        // Validation
        if (!data.title || !data.title.trim()) {
            throw new Error('Deal title is required');
        }

        if (data.title.length > 200) {
            throw new Error('Deal title must be 200 characters or less');
        }

        if (data.value !== undefined && data.value < 0) {
            throw new Error('Deal value must be non-negative');
        }

        // Verify pipeline exists and belongs to user
        const pipeline = this.pipelineModel.findById(data.pipelineId);
        if (!pipeline || pipeline.userId !== userId) {
            throw new Error('Pipeline not found');
        }

        if (!pipeline.isActive) {
            throw new Error('Cannot add deals to inactive pipeline');
        }

        // Verify stage belongs to pipeline
        const stage = this.stageModel.findById(data.stageId);
        if (!stage || stage.pipelineId !== data.pipelineId) {
            throw new Error('Stage does not belong to the specified pipeline');
        }

        // Validate email format if provided
        if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            throw new Error('Invalid email format');
        }

        const now = new Date().toISOString();

        const deal = this.dealModel.create({
            title: data.title.trim(),
            value: data.value || 0,
            currency: data.currency || 'USD',
            pipelineId: data.pipelineId,
            stageId: data.stageId,
            personName: data.personName?.trim(),
            organizationName: data.organizationName?.trim(),
            email: data.email?.trim(),
            phone: data.phone?.trim(),
            description: data.description?.trim(),
            expectedCloseDate: data.expectedCloseDate,
            probability: data.probability || stage.probability,
            userId,
            assignedTo: data.assignedTo,
            status: 'open',
            lastActivityAt: now,
            isRotten: false,
            source: data.source,
            labels: data.labels ? JSON.stringify(data.labels) : undefined,
            customFields: data.customFields ? JSON.stringify(data.customFields) : undefined
        });

        // Create history entry
        this.historyModel.create({
            dealId: deal.id,
            userId,
            eventType: 'created',
            toStageId: data.stageId,
            description: `Deal created in stage: ${stage.name}`,
            createdAt: now
        });

        return deal;
    }

    async getDeals(userId: number, filters: {
        pipelineId?: number;
        stageId?: number;
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
    } = {}): Promise<{ deals: Deal[]; pagination: any }> {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        const result = this.dealModel.findByUserId(userId, {
            ...filters,
            limit,
            offset
        });

        return {
            deals: result.deals,
            pagination: {
                total: result.total,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit)
            }
        };
    }

    async getDealById(id: number, userId: number): Promise<any | null> {
        const deal = this.dealModel.findById(id);

        if (!deal || deal.userId !== userId) {
            return null;
        }

        // Get pipeline and stage info
        const pipeline = this.pipelineModel.findById(deal.pipelineId);
        const stage = this.stageModel.findById(deal.stageId);

        // Get history
        const history = this.historyModel.findByDealId(id);

        // Calculate time in current stage
        const lastStageChange = this.historyModel.findLastStageChange(id);
        const timeInCurrentStage = lastStageChange
            ? Math.floor((new Date().getTime() - new Date(lastStageChange.createdAt).getTime()) / 1000)
            : Math.floor((new Date().getTime() - new Date(deal.createdAt).getTime()) / 1000);

        return {
            ...deal,
            pipeline: pipeline ? { id: pipeline.id, name: pipeline.name } : null,
            stage: stage ? { id: stage.id, name: stage.name } : null,
            history,
            timeInCurrentStage,
            labels: deal.labels ? JSON.parse(deal.labels) : [],
            customFields: deal.customFields ? JSON.parse(deal.customFields) : {}
        };
    }

    async updateDeal(dealId: number, userId: number, data: Partial<{
        title: string;
        value: number;
        currency: string;
        personName: string;
        organizationName: string;
        email: string;
        phone: string;
        description: string;
        expectedCloseDate: string;
        probability: number;
        assignedTo: number;
        labels: string[];
        customFields: Record<string, any>;
    }>): Promise<Deal | null> {
        // Validation
        if (data.title !== undefined) {
            if (!data.title.trim()) {
                throw new Error('Deal title cannot be empty');
            }
            if (data.title.length > 200) {
                throw new Error('Deal title must be 200 characters or less');
            }
        }

        if (data.value !== undefined && data.value < 0) {
            throw new Error('Deal value must be non-negative');
        }

        if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            throw new Error('Invalid email format');
        }

        const updateData: any = { ...data };

        if (data.labels) {
            updateData.labels = JSON.stringify(data.labels);
        }

        if (data.customFields) {
            updateData.customFields = JSON.stringify(data.customFields);
        }

        const deal = this.dealModel.update(dealId, userId, updateData);

        if (deal) {
            // Create history entry for significant changes
            const now = new Date().toISOString();
            if (data.value !== undefined) {
                this.historyModel.create({
                    dealId,
                    userId,
                    eventType: 'value_change',
                    toValue: data.value.toString(),
                    description: `Deal value updated to ${data.value}`,
                    createdAt: now
                });
            }
        }

        return deal;
    }

    async moveDealToStage(dealId: number, userId: number, toStageId: number, note?: string): Promise<any> {
        const deal = this.dealModel.findById(dealId);

        if (!deal) {
            throw new Error('Deal not found');
        }

        // Verify new stage belongs to same pipeline
        const toStage = this.stageModel.findById(toStageId);
        if (!toStage || toStage.pipelineId !== deal.pipelineId) {
            throw new Error('Stage does not belong to the deal\'s pipeline');
        }

        const fromStageId = deal.stageId;
        const fromStage = this.stageModel.findById(fromStageId);

        // Calculate time in previous stage
        const lastStageChange = this.historyModel.findLastStageChange(dealId);
        const now = new Date();
        const stageDuration = lastStageChange
            ? Math.floor((now.getTime() - new Date(lastStageChange.createdAt).getTime()) / 1000)
            : Math.floor((now.getTime() - new Date(deal.createdAt).getTime()) / 1000);

        // Update deal
        const updateData: any = {
            stageId: toStageId,
            probability: toStage.probability,
            lastActivityAt: now.toISOString()
        };

        const updatedDeal = this.dealModel.update(dealId, userId, updateData);

        // Create history entry
        this.historyModel.create({
            dealId,
            userId,
            eventType: 'stage_change',
            fromStageId,
            toStageId,
            stageDuration,
            description: note || `Moved from ${fromStage?.name} to ${toStage.name}`,
            createdAt: now.toISOString()
        });

        return {
            ...updatedDeal,
            message: 'Deal moved successfully',
            history: {
                fromStage: fromStage?.name,
                toStage: toStage.name,
                timeInPreviousStage: stageDuration
            }
        };
    }

    async closeDeal(dealId: number, userId: number, status: 'won' | 'lost', lostReason?: string): Promise<Deal | null> {
        const deal = this.dealModel.findById(dealId);

        if (!deal || deal.userId !== userId) {
            throw new Error('Deal not found');
        }

        if (status === 'lost' && !lostReason) {
            throw new Error('Lost reason is required when marking deal as lost');
        }

        const now = new Date().toISOString();

        const updatedDeal = this.dealModel.update(dealId, userId, {
            status,
            actualCloseDate: now,
            lostReason: status === 'lost' ? lostReason : undefined
        });

        // Create history entry
        this.historyModel.create({
            dealId: dealId,
            userId,
            eventType: status === 'won' ? 'deal_won' : 'deal_lost',
            description: status === 'won'
                ? 'Deal marked as won'
                : `Deal marked as lost: ${lostReason}`,
            createdAt: now
        });

        return updatedDeal;
    }

    async deleteDeal(dealId: number, userId: number): Promise<boolean> {
        return this.dealModel.delete(dealId, userId);
    }

    async getRottenDeals(userId: number, pipelineId?: number): Promise<Deal[]> {
        return this.dealModel.getRottenDeals(userId, pipelineId);
    }
}
