import { Deal, DealModel } from '../models/Deal';
import { Product, ProductModel } from '../models/Product';
import { DealHistory, DealHistoryModel } from '../models/DealHistory';
import { Label, LabelModel } from '../models/Label';
import { Pipeline, PipelineModel } from '../models/Pipeline';
import { PipelineStageModel } from '../models/PipelineStage';
import { Person, PersonModel } from '../../management/persons/models/Person';
import { Organization, OrganizationModel } from '../../management/organisations/models/Organization';

type ContactField = {
    value: string;
    type: string;
};

interface organizationData extends Organization {
    organizationId?: number;
}

interface personData extends Person {
    personId?: number;
}

export class DealService {
    constructor(
        private dealModel: DealModel,
        private historyModel: DealHistoryModel,
        private pipelineModel: PipelineModel,
        private stageModel: PipelineStageModel,
        private productModel: ProductModel,
        private organizationModel: OrganizationModel,
        private personModel: PersonModel,
        private labelModel: LabelModel
    ) { }

    async createDeal(userId: number, companyId: number,
        data: {
            title: string;
            pipelineId: number;
            stageId: number;
            value?: number;
            currency?: string;
            person?: personData;
            organization?: organizationData;
            emails?: ContactField[];
            phones?: ContactField[];
            description?: string;
            expectedCloseDate?: string;
            probability?: number;
            ownerIds?: number[],
            isVisibleToAll?: boolean,
            assignedTo?: number;
            source?: string;
            labelIds?: number[];
            products?: {
                item: string;
                price: number;
                quantity: number;
                tax: number;
                amount: number;
                discount?: number;
                billingDate?: string;
                description?: string;
            }[];
            customFields?: Record<string, any>;
        }): Promise<{ deal: Deal; products: Product[] }> {
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
        const pipeline = await this.pipelineModel.findById(data.pipelineId, companyId, userId);
        if (!pipeline) {
            throw new Error('Pipeline not found');
        }

        if (!pipeline.isActive) {
            throw new Error('Cannot add deals to inactive pipeline');
        }

        const organizationData = data.organization;
        let organization: Organization | null = null;

        if (organizationData) {
            if (!organizationData.organizationId) {
                organization = await this.organizationModel.create({
                    companyId,
                    name: organizationData.name,
                    industry: organizationData.industry,
                    website: organizationData.website,
                    emails: organizationData.emails,
                    phones: organizationData.phones,
                    address: organizationData.address,
                    description: organizationData.description,
                    status: organizationData.status
                });
            } else {
                organization = await this.organizationModel.findById(organizationData.organizationId, companyId);
            }
        }

        const personData = data.person;
        let person: Person | null = null;

        if (personData) {
            if (!personData.personId) {
                person = await this.personModel.create({
                    companyId,
                    firstName: personData.firstName,
                    lastName: personData.lastName,
                    emails: (personData.emails as any) || [],
                    phones: (personData.phones as any) || [],
                    organizationId: organization?.id
                });
            } else {
                person = await this.personModel.findById(personData.personId, companyId);
            }
        }

        // Verify stage belongs to pipeline
        const stage = await this.stageModel.findById(data.stageId);
        if (!stage || stage.pipelineId !== data.pipelineId) {
            throw new Error('Stage does not belong to the specified pipeline');
        }

        const ownerIds = Array.from(new Set([...(data.ownerIds || []), userId]));

        const deal = await this.dealModel.create({
            title: data.title.trim(),
            companyId,
            value: data.value || 0,
            currency: data.currency || 'USD',
            pipelineId: data.pipelineId,
            stageId: data.stageId,
            personId: person?.id,
            organizationId: organization?.id,
            email: data.emails,
            phone: data.phones,
            description: data.description?.trim(),
            expectedCloseDate: data.expectedCloseDate,
            probability: data.probability || stage.probability,
            userId,
            status: 'OPEN',
            lastActivityAt: new Date().toISOString(),
            source: data.source,
            labelIds: data.labelIds,
            ownerIds,
            customFields: data.customFields ? JSON.stringify(data.customFields) : undefined
        });

        if (deal && deal.ownerIds) {
            await this.pipelineModel.addOwnersToPipeline(deal.pipelineId, companyId, deal.ownerIds);
        }

        let products: Product[] = [];
        if (data.products?.length) {
            for (const p of data.products) {
                const product = await this.productModel.create({
                    dealId: deal.id,
                    userId,
                    companyId,
                    title: p.item,
                    price: p.price,
                    quantity: p.quantity,
                    tax: p.tax,
                    amount: p.amount,
                    discount: p.discount,
                    billingDate: p.billingDate,
                    description: p.description
                });
                products.push(product);
            }
        }

        const nowStr = new Date().toISOString();
        // Create history entry for initial stage
        await this.historyModel.create({
            dealId: deal.id,
            userId,
            companyId,
            eventType: 'stage_change',
            toStageId: data.stageId,
            description: `Deal created in stage: ${stage.name}`,
            createdAt: nowStr
        });

        // Also add the creation event
        await this.historyModel.create({
            dealId: deal.id,
            userId,
            companyId,
            eventType: `created deal ${deal.title}`,
            description: `Created deal ${deal.title}`,
            createdAt: nowStr
        });

        return {
            deal,
            products
        };
    }

    async searchDeals(
        userId: number,
        companyId: number,
        search: string,
        includeDeleted: boolean = false
    ): Promise<{
        deals: Deal[];
        pipeline: any[];
        stage: any[];
        person: Person[];
        organization: any[]
    }> {
        const searchTerm = search.trim();

        if (!searchTerm) {
            return {
                deals: [],
                pipeline: [],
                stage: [],
                person: [],
                organization: []
            };
        }

        const [deals, pipeline, stage, person, organization] = await Promise.all([
            this.dealModel.searchDeals(userId, companyId, searchTerm, includeDeleted),
            this.pipelineModel.searchByPipelineName(searchTerm, companyId),
            this.stageModel.searchByStageName(searchTerm, companyId),
            this.personModel.searchByPersonName(searchTerm, companyId),
            this.organizationModel.searchByOrganizationName(searchTerm, companyId)
        ]);

        return {
            deals,
            pipeline,
            stage,
            person,
            organization
        };
    }

    async getDealHistory(dealId: number, companyId: number): Promise<DealHistory[]> {
        return await this.historyModel.findByDealId(dealId, companyId);
    }

    async getDeals(userId: number, companyId: number, filters: {
        pipelineId?: number;
        stageId?: number;
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
        includeArchived?: boolean;
    } = {}): Promise<{ deals: any[]; pagination: any }> {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        const result = await this.dealModel.findByUserId(userId, companyId, {
            ...filters,
            limit,
            offset
        });

        const enrichedDeals = [];
        for (const deal of result.deals) {
            const [pipeline, stage] = await Promise.all([
                this.pipelineModel.findById(deal.pipelineId, companyId, userId),
                this.stageModel.findById(deal.stageId, companyId)
            ]);

            let person = null;
            if (deal.personId) {
                person = await this.personModel.findById(deal.personId, companyId);
            }

            let organization = null;
            if (deal.organizationId) {
                organization = await this.organizationModel.findById(deal.organizationId, companyId);
            }

            enrichedDeals.push({
                ...deal,
                pipeline: pipeline ? { id: pipeline.id, name: pipeline.name } : null,
                stage: stage ? { id: stage.id, name: stage.name, probability: stage.probability } : null,
                person: person ? {
                    id: person.id,
                    firstName: person.firstName,
                    lastName: person.lastName,
                    emails: person.emails
                } : null,
                organization: organization ? {
                    id: organization.id,
                    name: organization.name
                } : null,
                customFields: deal.customFields ? (typeof deal.customFields === 'string' ? JSON.parse(deal.customFields) : deal.customFields) : {}
            });
        }

        return {
            deals: enrichedDeals,
            pagination: {
                total: result.total,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit)
            }
        };
    }

    async getDealById(id: number, companyId: number, userId: number): Promise<any | null> {
        const deal = await this.dealModel.findById(id, companyId, userId);

        if (!deal) {
            return null;
        }

        const [pipeline, stage, products, history, lastStageChange] = await Promise.all([
            this.pipelineModel.findById(deal.pipelineId, companyId, userId),
            this.stageModel.findById(deal.stageId, companyId),
            this.productModel.findByDealId(id, companyId),
            this.historyModel.findByDealId(id, companyId),
            this.historyModel.findLastStageChange(id, companyId)
        ]);

        let personInfo: { person?: Person | null; labels?: Label[] } = {};
        if (deal.personId) {
            const [person, labels] = await Promise.all([
                this.personModel.findById(deal.personId, companyId),
                this.labelModel.findByPersonId(deal.personId, companyId)
            ]);
            personInfo.person = person;
            personInfo.labels = labels;
        }

        let organizationInfo: { organization?: Organization | null; labels?: Label[] } = {};
        if (deal.organizationId) {
            const [org, labels] = await Promise.all([
                this.organizationModel.findById(deal.organizationId, companyId),
                this.labelModel.findByOrganizationId(deal.organizationId, companyId)
            ]);
            organizationInfo.organization = org;
            organizationInfo.labels = labels;
        }

        const timeInCurrentStage = lastStageChange
            ? Math.floor((new Date().getTime() - new Date(lastStageChange.createdAt).getTime()) / 1000)
            : Math.floor((new Date().getTime() - new Date(deal.createdAt).getTime()) / 1000);

        return {
            ...deal,
            pipeline: pipeline ? { id: pipeline.id, name: pipeline.name } : null,
            stage: stage ? { id: stage.id, name: stage.name, probability: stage.probability } : null,
            person: personInfo.person ? {
                id: personInfo.person.id,
                firstName: personInfo.person.firstName,
                lastName: personInfo.person.lastName,
                emails: personInfo.person.emails,
                phones: personInfo.person.phones,
                labels: personInfo.labels
            } : null,
            organization: organizationInfo.organization,
            organizationLabels: organizationInfo.labels,
            products: products || [],
            history,
            timeInCurrentStage,
            customFields: deal.customFields ? (typeof deal.customFields === 'string' ? JSON.parse(deal.customFields) : deal.customFields) : {}
        };
    }

    async updateDeal(dealId: number, companyId: number, userId: number, data: Partial<Deal>): Promise<Deal | null> {
        const oldDeal = await this.dealModel.findById(dealId, companyId, userId);
        if (!oldDeal) return null;

        const updatedDeal = await this.dealModel.update(dealId, companyId, userId, data);

        if (updatedDeal) {
            const oldStageId = Number(oldDeal.stageId);
            const newStageId = data.stageId !== undefined ? Number(data.stageId) : oldStageId;

            if (newStageId !== oldStageId) {
                const now = new Date().toISOString();
                await this.historyModel.closeOpenStageRecord(dealId, companyId, now);

                const [fromStage, toStage] = await Promise.all([
                    this.stageModel.findById(oldStageId),
                    this.stageModel.findById(newStageId)
                ]);

                await this.historyModel.create({
                    dealId: updatedDeal.id,
                    userId,
                    companyId,
                    eventType: 'stage_change',
                    fromStageId: oldStageId,
                    toStageId: newStageId,
                    fromValue: fromStage?.name,
                    toValue: toStage?.name,
                    description: `Moved from ${fromStage?.name || 'Unknown'} to ${toStage?.name || 'Unknown'} via update`,
                    createdAt: now
                });
            }

            if (data.ownerIds || data.pipelineId) {
                await this.pipelineModel.recalculatePipelineOwners(updatedDeal.pipelineId, companyId);
                if (data.pipelineId && data.pipelineId !== oldDeal.pipelineId) {
                    await this.pipelineModel.recalculatePipelineOwners(oldDeal.pipelineId, companyId);
                }
            }

            await this.historyModel.create({
                dealId: updatedDeal.id,
                userId,
                companyId,
                toValue: "Updated",
                eventType: `updated deal ${updatedDeal.title}`,
                toStageId: updatedDeal.stageId,
                description: `Deal updated in stage: ${updatedDeal.title}`,
                createdAt: new Date().toISOString()
            });
        }
        return updatedDeal;
    }

    async makeDealAsWon(dealId: number, companyId: number, userId: number): Promise<Deal | null> {
        const deal = await this.dealModel.findById(dealId, companyId, userId);
        if (!deal) return null;

        const data = await this.dealModel.makeDealAsWon(dealId, companyId);

        if (data) {
            const now = new Date().toISOString();
            await this.historyModel.closeOpenStageRecord(dealId, companyId, now);
            await this.historyModel.create({
                dealId: data.id,
                userId,
                companyId,
                toValue: "Won",
                eventType: `won deal ${data.title}`,
                toStageId: data.stageId,
                description: `Deal won in stage: ${data.title}`,
                createdAt: now
            });
        }
        return data;
    }

    async makeDealAsLost(dealId: number, companyId: number, userId: number, info: { reason?: string, comment?: string }): Promise<Deal | null> {
        const deal = await this.dealModel.findById(dealId, companyId, userId);
        if (!deal) return null;

        const data = await this.dealModel.makeDealAsLost(dealId, companyId, info);

        if (data) {
            const now = new Date().toISOString();
            await this.historyModel.closeOpenStageRecord(dealId, companyId, now);
            await this.historyModel.create({
                dealId: data.id,
                userId,
                companyId,
                toValue: "Lost",
                eventType: `lost deal ${data.title}`,
                toStageId: data.stageId,
                description: `Deal lost in stage: ${data.title}`,
                createdAt: now
            });
        }
        return data;
    }

    async resetDeal(dealId: number, companyId: number, userId: number): Promise<Deal | null> {
        const deal = await this.dealModel.findById(dealId, companyId, userId);
        if (!deal) return null;

        const data = await this.dealModel.resetDeal(dealId, companyId);

        if (data) {
            await this.historyModel.create({
                dealId: data.id,
                userId,
                companyId,
                eventType: 'stage_change',
                toStageId: data.stageId,
                description: `Deal reopened in stage: ${data.title}`,
                createdAt: new Date().toISOString()
            });

            await this.historyModel.create({
                dealId: data.id,
                userId,
                companyId,
                toValue: "Reopened",
                eventType: `reset deal ${data.title}`,
                toStageId: data.stageId,
                description: `Deal reset in stage: ${data.title}`,
                createdAt: new Date().toISOString()
            });
        }
        return data;
    }

    async moveDealToStage(dealId: number, companyId: number, userId: number, toStageId: number, note?: string): Promise<any> {
        const deal = await this.dealModel.findById(dealId, companyId);
        if (!deal) {
            throw new Error('Deal not found');
        }

        const toStage = await this.stageModel.findById(toStageId);
        if (!toStage || toStage.pipelineId !== deal.pipelineId) {
            throw new Error('Stage does not belong to the deal\'s pipeline');
        }

        const fromStageId = Number(deal.stageId);
        const toStageIdNum = Number(toStageId);
        const fromStage = await this.stageModel.findById(fromStageId);
        const nowStr = new Date().toISOString();

        if (fromStageId !== toStageIdNum) {
            await this.historyModel.closeOpenStageRecord(dealId, companyId, nowStr);

            const updatedDeal = await this.dealModel.update(dealId, companyId, userId, {
                stageId: toStageIdNum,
                probability: toStage.probability,
                lastActivityAt: nowStr
            });

            await this.historyModel.create({
                dealId,
                userId,
                companyId,
                fromValue: fromStage?.name,
                toValue: toStage.name,
                eventType: 'stage_change',
                fromStageId,
                toStageId: toStageIdNum,
                description: note || `Moved from ${fromStage?.name} to ${toStage.name}`,
                createdAt: nowStr
            });

            return {
                ...updatedDeal,
                message: 'Deal moved successfully',
                history: {
                    fromStage: fromStage?.name,
                    toStage: toStage.name
                }
            };
        } else {
            const updatedDeal = await this.dealModel.update(dealId, companyId, userId, {
                lastActivityAt: nowStr
            });

            return {
                ...updatedDeal,
                message: 'Deal stage unchanged',
                history: null
            };
        }
    }

    async closeDeal(dealId: number, companyId: number, userId: number, status: 'WON' | 'LOST', lostReason?: string): Promise<Deal | null> {
        const deal = await this.dealModel.findById(dealId, companyId);
        if (!deal || deal.userId !== userId) {
            throw new Error('Deal not found');
        }

        if (status === 'LOST' && !lostReason) {
            throw new Error('Lost reason is required when marking deal as lost');
        }

        const now = new Date().toISOString();
        const updatedDeal = await this.dealModel.update(dealId, companyId, userId, {
            status,
            actualCloseDate: now,
            lostReason: status === 'LOST' ? lostReason : undefined
        });

        if (updatedDeal) {
            await this.historyModel.closeOpenStageRecord(dealId, companyId, now);
        }

        await this.historyModel.create({
            dealId: dealId,
            userId,
            companyId,
            toValue: status === 'WON' ? 'Won' : 'Lost',
            eventType: status === 'WON' ? 'deal_won' : 'deal_lost',
            description: status === 'WON'
                ? 'Deal marked as won'
                : `Deal marked as lost: ${lostReason}`,
            createdAt: now
        });

        return updatedDeal;
    }

    async deleteDeal(dealId: number, companyId: number, userId: number): Promise<boolean> {
        const deal = await this.dealModel.findById(dealId, companyId, userId);
        if (!deal) return false;

        const success = await this.dealModel.delete(dealId, companyId, userId);

        if (success) {
            const now = new Date().toISOString();
            await this.historyModel.closeOpenStageRecord(dealId, companyId, now);
            await this.pipelineModel.recalculatePipelineOwners(deal.pipelineId, companyId);
            await this.historyModel.create({
                dealId: dealId,
                userId,
                companyId,
                toValue: "Deleted",
                eventType: 'deal_deleted',
                description: 'Deal deleted',
                createdAt: now
            });
        }

        return success;
    }

    async getRottenDeals(userId: number, companyId: number, pipelineId?: number): Promise<any[]> {
        const deals = await this.dealModel.getRottenDeals(userId, companyId, pipelineId);

        const enrichedDeals = [];
        for (const deal of deals) {
            const [pipeline, stage] = await Promise.all([
                this.pipelineModel.findById(deal.pipelineId, companyId, userId),
                this.stageModel.findById(deal.stageId)
            ]);

            let person = null;
            if (deal.personId) {
                person = await this.personModel.findById(deal.personId, companyId);
            }

            let organization = null;
            if (deal.organizationId) {
                organization = await this.organizationModel.findById(deal.organizationId, companyId);
            }

            enrichedDeals.push({
                ...deal,
                pipeline: pipeline ? { id: pipeline.id, name: pipeline.name } : null,
                stage: stage ? { id: stage.id, name: stage.name } : null,
                person: person ? {
                    id: person.id,
                    firstName: person.firstName,
                    lastName: person.lastName
                } : null,
                organization: organization ? {
                    id: organization.id,
                    name: organization.name
                } : null
            });
        }
        return enrichedDeals;
    }

    async archiveDeals(dealIds: number[], companyId: number, userId: number): Promise<boolean> {
        const success = await this.dealModel.archive(dealIds, companyId, userId);
        if (success) {
            const now = new Date().toISOString();
            for (const dealId of dealIds) {
                await this.historyModel.create({
                    dealId,
                    userId,
                    companyId,
                    toValue: "Archived",
                    eventType: 'deal_archived',
                    description: 'Deal archived',
                    createdAt: now
                });
            }
        }
        return success;
    }

    async unarchiveDeals(dealIds: number[], companyId: number, userId: number): Promise<boolean> {
        const success = await this.dealModel.unarchive(dealIds, companyId, userId);
        if (success) {
            const now = new Date().toISOString();
            for (const dealId of dealIds) {
                await this.historyModel.create({
                    dealId,
                    userId,
                    companyId,
                    toValue: "Unarchived",
                    eventType: 'deal_unarchived',
                    description: 'Deal unarchived',
                    createdAt: now
                });
            }
        }
        return success;
    }

    async getArchivedDeals(userId: number, companyId: number, filters: {
        pipelineId?: number;
        stageId?: number;
        page?: number;
        limit?: number;
    } = {}): Promise<{ deals: any[]; pagination: any }> {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        const result = await this.dealModel.getArchivedDeals(userId, companyId, {
            ...filters,
            limit,
            offset
        });

        const enrichedDeals = [];
        for (const deal of result.deals) {
            const [pipeline, stage] = await Promise.all([
                this.pipelineModel.findById(deal.pipelineId, companyId, userId),
                this.stageModel.findById(deal.stageId)
            ]);

            let person = null;
            if (deal.personId) {
                person = await this.personModel.findById(deal.personId, companyId);
            }

            let organization = null;
            if (deal.organizationId) {
                organization = await this.organizationModel.findById(deal.organizationId, companyId);
            }

            enrichedDeals.push({
                ...deal,
                pipeline: pipeline ? { id: pipeline.id, name: pipeline.name } : null,
                stage: stage ? { id: stage.id, name: stage.name, probability: stage.probability } : null,
                person: person ? {
                    id: person.id,
                    firstName: person.firstName,
                    lastName: person.lastName,
                    emails: person.emails
                } : null,
                organization: organization ? {
                    id: organization.id,
                    name: organization.name
                } : null,
                customFields: deal.customFields ? (typeof deal.customFields === 'string' ? JSON.parse(deal.customFields) : deal.customFields) : {}
            });
        }

        return {
            deals: enrichedDeals,
            pagination: {
                total: result.total,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit)
            }
        };
    }

    async permanentDeleteArchivedDeals(dealIds: number[], companyId: number, userId: number): Promise<boolean> {
        return await this.dealModel.hardDeleteArchived(dealIds, companyId, userId);
    }

    async removeLabelFromDeal(dealId: number, companyId: number, labelId: number, userId: number): Promise<Deal | null> {
        const deal = await this.dealModel.findById(dealId, companyId, userId);
        if (!deal) return null;

        return await this.dealModel.removeLabelFromDeal(dealId, companyId, labelId);
    }

    async getDealStageDurations(dealId: number, companyId: number): Promise<Array<{ stageId: number; stageName: string; totalDuration: number }>> {
        return await this.historyModel.getStageDurations(dealId, companyId);
    }
}
