import { Deal, DealModel } from '../models/Deal';
import { Product, ProductModel } from '../models/Product';
import { DealHistory, DealHistoryModel } from '../models/DealHistory';
import { Label, LabelModel } from '../models/Label';
import { Pipeline, PipelineModel } from '../models/Pipeline';
import { PipelineStageModel, searchResult } from '../models/PipelineStage';
import { Person, PersonModel } from '../../management/persons/models/Person';
import { Organization, OrganizationModel, searchOrgResult } from '../../management/organisations/models/Organization';


type ContactField = {
    value: string;
    type: string; // "Work" | "Personal" | "Home" | etc
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
        const pipeline = this.pipelineModel.findById(data.pipelineId);
        if (!pipeline) {
            throw new Error('Pipeline not found');
        }

        if (!pipeline.isActive) {
            throw new Error('Cannot add deals to inactive pipeline');
        }

        const organizationData = data.organization;
        // step 1 create organization if not exists

        let organization: Organization | undefined;

        if (organizationData) {
            if (!organizationData.organizationId) {
                const org = this.organizationModel.create({
                    name: organizationData.name,
                    industry: organizationData.industry,
                    website: organizationData.website,
                    emails: organizationData.emails,
                    phones: organizationData.phones,
                    address: organizationData.address,
                    description: organizationData.description,
                    status: organizationData.status
                });
                organization = org;
            } else {
                organization = this.organizationModel.findById(organizationData.organizationId);
            }
        }




        // step 2. create person if not exists

        const personData = data.person;

        let person: Person | undefined;

        if (personData) {
            if (!personData.personId) {
                const pers = this.personModel.create({
                    firstName: personData.firstName,
                    lastName: personData.lastName,
                    emails: personData.emails,
                    phones: personData.phones,
                    organizationId: organization?.id
                });

                person = pers;
            } else {
                person = this.personModel.findById(personData.personId);
            }
        }



        // Verify stage belongs to pipeline
        const stage = this.stageModel.findById(data.stageId);
        if (!stage || stage.pipelineId !== data.pipelineId) {
            throw new Error('Stage does not belong to the specified pipeline');
        }


        // add person
        if (data.person) {

        }
        console.log(data);


        const deal = this.dealModel.create({
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
            assignedTo: data.assignedTo,
            status: 'OPEN',
            lastActivityAt: new Date().toISOString(),
            isRotten: false,
            source: data.source,
            labelIds: data.labelIds,
            customFields: data.customFields ? JSON.stringify(data.customFields) : undefined
        });


        // create Product 
        let products: Product[] = [];

        if (data.products?.length) {
            for (const p of data.products) {
                const product = this.productModel.create({
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

        // Create history entry
        this.historyModel.create({
            dealId: deal.id,
            userId,
            eventType: `created deal ${deal.title}`,
            toStageId: data.stageId,
            description: `Deal created in stage: ${stage.name}`,
            createdAt: new Date().toISOString()
        });
        const response = {
            deal,
            organization,
            person,
            products
        }

        return response;
    }

    async searchDeals(search: string): Promise<{ deals: Deal[], pipeline: searchResult[], stage: searchResult[], person: Person[], organization: searchOrgResult[] }> {

        const deals = this.dealModel.searchDeals(search);

        const pipeline = this.pipelineModel.searchByPipelineName(search);

        const stage = this.stageModel.searchByStageName(search);



        const person = this.personModel.searchByPersonName(search);



        const organization = this.organizationModel.searchByOrganizationName(search);

        return {
            deals,
            pipeline,
            stage,
            person,
            organization
        };
    }

    async getDealHistory(dealId: number): Promise<DealHistory[]> {
        return this.historyModel.findByDealId(dealId);
    }

    async getDeals(userId: number, filters: {
        pipelineId?: number;
        stageId?: number;
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
    } = {}): Promise<{ deals: any[]; pagination: any }> {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;

        const result = this.dealModel.findByUserId(userId, {
            ...filters,
            limit,
            offset
        });

        // Enrich each deal with related data
        const enrichedDeals = result.deals.map(deal => {
            const pipeline = this.pipelineModel.findById(deal.pipelineId);
            const stage = this.stageModel.findById(deal.stageId);

            let person = null;
            if (deal.personId) {
                person = this.personModel.findById(deal.personId);
            }

            let organization = null;
            if (deal.organizationId) {
                organization = this.organizationModel.findById(deal.organizationId);
            }

            return {
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
                customFields: deal.customFields ? JSON.parse(deal.customFields) : {}
            };
        });

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
        const deal = this.dealModel.findById(id);

        if (!deal || deal.userId !== userId) {
            return null;
        }

        // Get pipeline and stage info
        const pipeline = this.pipelineModel.findById(deal.pipelineId);
        const stage = this.stageModel.findById(deal.stageId);

        // Get person info if personId exists
        let person: { person?: Person; labels?: Label[] } = {};

        if (deal.personId) {
            person.person = this.personModel.findById(deal.personId);
            person.labels = this.labelModel.findByPersonId(deal.personId);
        }


        // Get organization info if organizationId exists
        let organization: { organization?: Organization; labels?: Label[] } = {};
        if (deal.organizationId) {
            organization.organization = this.organizationModel.findById(deal.organizationId);
            organization.labels = this.labelModel.findByOrganizationId(deal.organizationId);
        }

        // Get products associated with this deal
        const products = this.productModel.findByDealId(id);

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
            stage: stage ? { id: stage.id, name: stage.name, probability: stage.probability } : null,
            person: person.person ? {
                id: person.person.id,
                firstName: person.person.firstName,
                lastName: person.person.lastName,
                emails: person.person.emails,
                phones: person.person.phones,
                labels: person.labels
            } : null,
            organization: organization.organization,
            organizationLabels: organization.labels,
            products: products || [],
            history,
            timeInCurrentStage,
            customFields: deal.customFields ? JSON.parse(deal.customFields) : {}
        };
    }

    async updateDeal(dealId: number, userId: number, data: Partial<Deal>): Promise<Deal | null> {
        const updateData = this.dealModel.update(dealId, userId, data);

        if (updateData) {
            this.historyModel.create({
                dealId: updateData.id,
                userId,
                toValue: "Updated",
                eventType: `updated deal ${updateData.title}`,
                toStageId: updateData.stageId,
                description: `Deal updated in stage: ${updateData?.title}`,
                createdAt: new Date().toISOString()
            });
        }
        return updateData;
    }

    async makeDealAsWon(dealId: number): Promise<Deal | null> {
        const data = this.dealModel.makeDealAsWon(dealId);

        if (data) {
            this.historyModel.create({
                dealId: data.id,
                userId: data.userId,
                toValue: "Won",
                eventType: `won deal ${data.title}`,
                toStageId: data.stageId,
                description: `Deal won in stage: ${data?.title}`,
                createdAt: new Date().toISOString()
            });
        }
        return data;
    }

    async makeDealAsLost(dealId: number, info: { reason?: string, comment?: string }): Promise<Deal | null> {
        console.log("log from service", info);
        const data = this.dealModel.makeDealAsLost(dealId, info);

        if (data) {
            this.historyModel.create({
                dealId: data.id,
                userId: data.userId,
                toValue: "Lost",
                eventType: `lost deal ${data.title}`,
                toStageId: data.stageId,
                description: `Deal lost in stage: ${data?.title}`,
                createdAt: new Date().toISOString()
            });
        }
        return data;
    }

    async resetDeal(dealId: number): Promise<Deal | null> {
        const data = this.dealModel.resetDeal(dealId);

        if (data) {
            this.historyModel.create({
                dealId: data.id,
                userId: data.userId,
                toValue: "Reopened",
                eventType: `reset deal ${data.title}`,
                toStageId: data.stageId,
                description: `Deal reset in stage: ${data?.title}`,
                createdAt: new Date().toISOString()
            });
        }
        return data;
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
            toValue: "Updated Stage",
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

    async closeDeal(dealId: number, userId: number, status: 'WON' | 'LOST', lostReason?: string): Promise<Deal | null> {
        const deal = this.dealModel.findById(dealId);

        if (!deal || deal.userId !== userId) {
            throw new Error('Deal not found');
        }

        if (status === 'LOST' && !lostReason) {
            throw new Error('Lost reason is required when marking deal as lost');
        }

        const now = new Date().toISOString();

        const updatedDeal = this.dealModel.update(dealId, userId, {
            status,
            actualCloseDate: now,
            lostReason: status === 'LOST' ? lostReason : undefined
        });

        // Create history entry
        this.historyModel.create({
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
        const data = this.dealModel.delete(dealId, userId);

        if (data) {
            this.historyModel.create({
                dealId: dealId,
                userId,
                toValue: "Deleted",
                eventType: 'deal_deleted',
                description: 'Deal deleted',
                createdAt: new Date().toISOString()
            });
        }

        return data;
    }

    async getRottenDeals(userId: number, pipelineId?: number): Promise<any[]> {
        const deals = this.dealModel.getRottenDeals(userId, pipelineId);

        // Enrich each deal with related data
        return deals.map(deal => {
            const pipeline = this.pipelineModel.findById(deal.pipelineId);
            const stage = this.stageModel.findById(deal.stageId);

            let person = null;
            if (deal.personId) {
                person = this.personModel.findById(deal.personId);
            }

            let organization = null;
            if (deal.organizationId) {
                organization = this.organizationModel.findById(deal.organizationId);
            }

            return {
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
            };
        });
    }
}
