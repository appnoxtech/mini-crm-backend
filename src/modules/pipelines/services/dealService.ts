import { Deal, DealModel } from '../models/Deal';
import { Product, ProductModel } from '../models/Product';
import { DealHistory, DealHistoryModel } from '../models/DealHistory';
import { Label, LabelModel } from '../models/Label';
import { Pipeline, PipelineModel } from '../models/Pipeline';
import { PipelineStageModel } from '../models/PipelineStage';
import { Person, PersonModel } from '../../management/persons/models/Person';
import { Organization, OrganizationModel } from '../../management/organisations/models/Organization';
import { eventBus } from '../../../infrastructure/event-bus';

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

    async createDeal(userId: number,
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
        const pipeline = await this.pipelineModel.findById(data.pipelineId, userId);
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
                organization = await this.organizationModel.findById(organizationData.organizationId);
            }
        }

        const personData = data.person;
        let person: Person | null = null;

        if (personData) {
            if (!personData.personId) {
                person = await this.personModel.create({
                    firstName: personData.firstName,
                    lastName: personData.lastName,
                    emails: personData.emails,
                    phones: personData.phones,
                    organizationId: organization?.id
                });
            } else {
                person = await this.personModel.findById(personData.personId);
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
            await this.pipelineModel.addOwnersToPipeline(deal.pipelineId, deal.ownerIds);
        }

        let products: Product[] = [];
        if (data.products?.length) {
            for (const p of data.products) {
                const product = await this.productModel.create({
                    dealId: deal.id,
                    userId,
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
            eventType: 'stage_change',
            toStageId: data.stageId,
            description: `Deal created in stage: ${stage.name}`,
            createdAt: nowStr
        });

        // Also add the creation event
        await this.historyModel.create({
            dealId: deal.id,
            userId,
            eventType: `created deal ${deal.title}`,
            description: `Created deal ${deal.title}`,
            createdAt: nowStr
        });

        // Emit deal.created event for Slack notifications
        eventBus.publish({
            type: 'deal.created',
            tenantId: String(userId),
            timestamp: new Date(),
            userId,
            payload: {
                dealId: deal.id,
                title: deal.title,
                value: deal.value || null,
                currency: deal.currency || null,
                pipelineId: deal.pipelineId,
                stageId: deal.stageId,
                stageName: stage.name,
                personName: person?.firstName || undefined,
                organizationName: organization?.name || undefined,
            },
        });

        return {
            deal,
            products
        };
    }

    async searchDeals(
        userId: number,
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
            this.dealModel.searchDeals(userId, searchTerm, includeDeleted),
            this.pipelineModel.searchByPipelineName(searchTerm),
            this.stageModel.searchByStageName(searchTerm),
            this.personModel.searchByPersonName(searchTerm),
            this.organizationModel.searchByOrganizationName(searchTerm)
        ]);

        return {
            deals,
            pipeline,
            stage,
            person,
            organization
        };
    }

    async getDealHistory(dealId: number): Promise<DealHistory[]> {
        return await this.historyModel.findByDealId(dealId);
    }

    async getDeals(userId: number, filters: {
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

        const result = await this.dealModel.findByUserId(userId, {
            ...filters,
            limit,
            offset
        });

        const enrichedDeals = [];
        for (const deal of result.deals) {
            const [pipeline, stage] = await Promise.all([
                this.pipelineModel.findById(deal.pipelineId, userId),
                this.stageModel.findById(deal.stageId)
            ]);

            let person = null;
            if (deal.personId) {
                person = await this.personModel.findById(deal.personId);
            }

            let organization = null;
            if (deal.organizationId) {
                organization = await this.organizationModel.findById(deal.organizationId);
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

    async getDealById(id: number, userId: number): Promise<any | null> {
        const deal = await this.dealModel.findById(id, userId);

        if (!deal) {
            return null;
        }

        const [pipeline, stage, products, history, lastStageChange] = await Promise.all([
            this.pipelineModel.findById(deal.pipelineId, userId),
            this.stageModel.findById(deal.stageId),
            this.productModel.findByDealId(id),
            this.historyModel.findByDealId(id),
            this.historyModel.findLastStageChange(id)
        ]);

        let personInfo: { person?: Person | null; labels?: Label[] } = {};
        if (deal.personId) {
            const [person, labels] = await Promise.all([
                this.personModel.findById(deal.personId),
                this.labelModel.findByPersonId(deal.personId)
            ]);
            personInfo.person = person;
            personInfo.labels = labels;
        }

        let organizationInfo: { organization?: Organization | null; labels?: Label[] } = {};
        if (deal.organizationId) {
            const [org, labels] = await Promise.all([
                this.organizationModel.findById(deal.organizationId),
                this.labelModel.findByOrganizationId(deal.organizationId)
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

    async updateDeal(dealId: number, userId: number, data: Partial<Deal>): Promise<Deal | null> {
        const oldDeal = await this.dealModel.findById(dealId, userId);
        if (!oldDeal) return null;

        const updatedDeal = await this.dealModel.update(dealId, userId, data);

        if (updatedDeal) {
            const oldStageId = Number(oldDeal.stageId);
            const newStageId = data.stageId !== undefined ? Number(data.stageId) : oldStageId;

            if (newStageId !== oldStageId) {
                const now = new Date().toISOString();
                await this.historyModel.closeOpenStageRecord(dealId, now);

                const [fromStage, toStage] = await Promise.all([
                    this.stageModel.findById(oldStageId),
                    this.stageModel.findById(newStageId)
                ]);

                await this.historyModel.create({
                    dealId: updatedDeal.id,
                    userId,
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
                await this.pipelineModel.recalculatePipelineOwners(updatedDeal.pipelineId);
                if (data.pipelineId && data.pipelineId !== oldDeal.pipelineId) {
                    await this.pipelineModel.recalculatePipelineOwners(oldDeal.pipelineId);
                }
            }

            await this.historyModel.create({
                dealId: updatedDeal.id,
                userId,
                toValue: "Updated",
                eventType: `updated deal ${updatedDeal.title}`,
                toStageId: updatedDeal.stageId,
                description: `Deal updated in stage: ${updatedDeal.title}`,
                createdAt: new Date().toISOString()
            });
        }
        return updatedDeal;
    }

    async makeDealAsWon(dealId: number, userId: number): Promise<Deal | null> {
        const deal = await this.dealModel.findById(dealId, userId);
        if (!deal) return null;

        const data = await this.dealModel.makeDealAsWon(dealId);

        if (data) {
            const now = new Date().toISOString();
            await this.historyModel.closeOpenStageRecord(dealId, now);
            await this.historyModel.create({
                dealId: data.id,
                userId,
                toValue: "Won",
                eventType: `won deal ${data.title}`,
                toStageId: data.stageId,
                description: `Deal won in stage: ${data.title}`,
                createdAt: now
            });

            // Emit deal.won event for Slack notifications
            eventBus.publish({
                type: 'deal.won',
                tenantId: String(userId),
                timestamp: new Date(),
                userId,
                payload: {
                    dealId: data.id,
                    title: data.title,
                    value: data.value || null,
                    currency: data.currency || null,
                },
            });
        }
        return data;
    }

    async makeDealAsLost(dealId: number, userId: number, info: { reason?: string, comment?: string }): Promise<Deal | null> {
        const deal = await this.dealModel.findById(dealId, userId);
        if (!deal) return null;

        const data = await this.dealModel.makeDealAsLost(dealId, info);

        if (data) {
            const now = new Date().toISOString();
            await this.historyModel.closeOpenStageRecord(dealId, now);
            await this.historyModel.create({
                dealId: data.id,
                userId,
                toValue: "Lost",
                eventType: `lost deal ${data.title}`,
                toStageId: data.stageId,
                description: `Deal lost in stage: ${data.title}`,
                createdAt: now
            });

            // Emit deal.lost event for Slack notifications
            eventBus.publish({
                type: 'deal.lost',
                tenantId: String(userId),
                timestamp: new Date(),
                userId,
                payload: {
                    dealId: data.id,
                    title: data.title,
                    value: data.value || null,
                    lostReason: info.reason,
                },
            });
        }
        return data;
    }

    async resetDeal(dealId: number, userId: number): Promise<Deal | null> {
        const deal = await this.dealModel.findById(dealId, userId);
        if (!deal) return null;

        const data = await this.dealModel.resetDeal(dealId);

        if (data) {
            await this.historyModel.create({
                dealId: data.id,
                userId,
                eventType: 'stage_change',
                toStageId: data.stageId,
                description: `Deal reopened in stage: ${data.title}`,
                createdAt: new Date().toISOString()
            });

            await this.historyModel.create({
                dealId: data.id,
                userId,
                toValue: "Reopened",
                eventType: `reset deal ${data.title}`,
                toStageId: data.stageId,
                description: `Deal reset in stage: ${data.title}`,
                createdAt: new Date().toISOString()
            });
        }
        return data;
    }

    async moveDealToStage(dealId: number, userId: number, toStageId: number, note?: string): Promise<any> {
        const deal = await this.dealModel.findById(dealId);
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
            await this.historyModel.closeOpenStageRecord(dealId, nowStr);

            const updatedDeal = await this.dealModel.update(dealId, userId, {
                stageId: toStageIdNum,
                probability: toStage.probability,
                lastActivityAt: nowStr
            });

            await this.historyModel.create({
                dealId,
                userId,
                fromValue: fromStage?.name,
                toValue: toStage.name,
                eventType: 'stage_change',
                fromStageId,
                toStageId: toStageIdNum,
                description: note || `Moved from ${fromStage?.name} to ${toStage.name}`,
                createdAt: nowStr
            });

            // Emit deal.stage_changed event for Slack notifications
            eventBus.publish({
                type: 'deal.stage_changed',
                tenantId: String(userId),
                timestamp: new Date(),
                userId,
                payload: {
                    dealId,
                    title: deal.title,
                    fromStage: fromStage?.name || 'Unknown',
                    toStage: toStage.name,
                    value: deal.value || null,
                },
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
            const updatedDeal = await this.dealModel.update(dealId, userId, {
                lastActivityAt: nowStr
            });

            return {
                ...updatedDeal,
                message: 'Deal stage unchanged',
                history: null
            };
        }
    }

    async closeDeal(dealId: number, userId: number, status: 'WON' | 'LOST', lostReason?: string): Promise<Deal | null> {
        const deal = await this.dealModel.findById(dealId);
        if (!deal || deal.userId !== userId) {
            throw new Error('Deal not found');
        }

        if (status === 'LOST' && !lostReason) {
            throw new Error('Lost reason is required when marking deal as lost');
        }

        const now = new Date().toISOString();
        const updatedDeal = await this.dealModel.update(dealId, userId, {
            status,
            actualCloseDate: now,
            lostReason: status === 'LOST' ? lostReason : undefined
        });

        if (updatedDeal) {
            await this.historyModel.closeOpenStageRecord(dealId, now);
        }

        await this.historyModel.create({
            dealId: dealId,
            userId,
            toValue: status === 'WON' ? 'Won' : 'Lost',
            eventType: status === 'WON' ? 'deal_won' : 'deal_lost',
            description: status === 'WON'
                ? 'Deal marked as won'
                : `Deal marked as lost: ${lostReason}`,
            createdAt: now
        });

        return updatedDeal;
    }

    async deleteDeal(dealId: number, userId: number): Promise<boolean> {
        const deal = await this.dealModel.findById(dealId, userId);
        if (!deal) return false;

        const success = await this.dealModel.delete(dealId, userId);

        if (success) {
            const now = new Date().toISOString();
            await this.historyModel.closeOpenStageRecord(dealId, now);
            await this.pipelineModel.recalculatePipelineOwners(deal.pipelineId);
            await this.historyModel.create({
                dealId: dealId,
                userId,
                toValue: "Deleted",
                eventType: 'deal_deleted',
                description: 'Deal deleted',
                createdAt: now
            });
        }

        return success;
    }

    async getRottenDeals(userId: number, pipelineId?: number): Promise<any[]> {
        const deals = await this.dealModel.getRottenDeals(userId, pipelineId);

        const enrichedDeals = [];
        for (const deal of deals) {
            const [pipeline, stage] = await Promise.all([
                this.pipelineModel.findById(deal.pipelineId, userId),
                this.stageModel.findById(deal.stageId)
            ]);

            let person = null;
            if (deal.personId) {
                person = await this.personModel.findById(deal.personId);
            }

            let organization = null;
            if (deal.organizationId) {
                organization = await this.organizationModel.findById(deal.organizationId);
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

    async archiveDeals(dealIds: number[], userId: number): Promise<boolean> {
        const success = await this.dealModel.archive(dealIds, userId);
        if (success) {
            const now = new Date().toISOString();
            for (const dealId of dealIds) {
                await this.historyModel.create({
                    dealId,
                    userId,
                    toValue: "Archived",
                    eventType: 'deal_archived',
                    description: 'Deal archived',
                    createdAt: now
                });
            }
        }
        return success;
    }

    async unarchiveDeals(dealIds: number[], userId: number): Promise<boolean> {
        const success = await this.dealModel.unarchive(dealIds, userId);
        if (success) {
            const now = new Date().toISOString();
            for (const dealId of dealIds) {
                await this.historyModel.create({
                    dealId,
                    userId,
                    toValue: "Unarchived",
                    eventType: 'deal_unarchived',
                    description: 'Deal unarchived',
                    createdAt: now
                });
            }
        }
        return success;
    }

    async getArchivedDeals(userId: number, filters: {
        pipelineId?: number;
        stageId?: number;
        page?: number;
        limit?: number;
    } = {}): Promise<{ deals: any[]; pagination: any }> {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        const result = await this.dealModel.getArchivedDeals(userId, {
            ...filters,
            limit,
            offset
        });

        const enrichedDeals = [];
        for (const deal of result.deals) {
            const [pipeline, stage] = await Promise.all([
                this.pipelineModel.findById(deal.pipelineId, userId),
                this.stageModel.findById(deal.stageId)
            ]);

            let person = null;
            if (deal.personId) {
                person = await this.personModel.findById(deal.personId);
            }

            let organization = null;
            if (deal.organizationId) {
                organization = await this.organizationModel.findById(deal.organizationId);
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

    async permanentDeleteArchivedDeals(dealIds: number[], userId: number): Promise<boolean> {
        return await this.dealModel.hardDeleteArchived(dealIds, userId);
    }

    async removeLabelFromDeal(dealId: number, labelId: number, userId: number): Promise<Deal | null> {
        const deal = await this.dealModel.findById(dealId, userId);
        if (!deal) return null;

        return await this.dealModel.removeLabelFromDeal(dealId, labelId);
    }

    async getDealStageDurations(dealId: number): Promise<Array<{ stageId: number; stageName: string; totalDuration: number }>> {
        return await this.historyModel.getStageDurations(dealId);
    }
}
