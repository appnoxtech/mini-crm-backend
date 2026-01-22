import { Deal, DealModel } from '../models/Deal';
import { Product, ProductModel } from '../models/Product';
import { DealHistory, DealHistoryModel } from '../models/DealHistory';
import { LabelModel } from '../models/Label';
import { PipelineModel } from '../models/Pipeline';
import { PipelineStageModel, searchResult } from '../models/PipelineStage';
import { Person, PersonModel } from '../../management/persons/models/Person';
import { Organization, OrganizationModel, searchOrgResult } from '../../management/organisations/models/Organization';
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
export declare class DealService {
    private dealModel;
    private historyModel;
    private pipelineModel;
    private stageModel;
    private productModel;
    private organizationModel;
    private personModel;
    private labelModel;
    constructor(dealModel: DealModel, historyModel: DealHistoryModel, pipelineModel: PipelineModel, stageModel: PipelineStageModel, productModel: ProductModel, organizationModel: OrganizationModel, personModel: PersonModel, labelModel: LabelModel);
    createDeal(userId: number, data: {
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
        ownerIds?: number[];
        isVisibleToAll?: boolean;
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
    }): Promise<{
        deal: Deal;
        products: Product[];
    }>;
    searchDeals(userId: number, search: string, includeDeleted?: boolean): Promise<{
        deals: Deal[];
        pipeline: searchResult[];
        stage: searchResult[];
        person: Person[];
        organization: searchOrgResult[];
    }>;
    getDealHistory(dealId: number): Promise<DealHistory[]>;
    getDeals(userId: number, filters?: {
        pipelineId?: number;
        stageId?: number;
        status?: string;
        search?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        deals: any[];
        pagination: any;
    }>;
    getDealById(id: number, userId: number): Promise<any | null>;
    updateDeal(dealId: number, userId: number, data: Partial<Deal>): Promise<Deal | null>;
    makeDealAsWon(dealId: number): Promise<Deal | null>;
    makeDealAsLost(dealId: number, info: {
        reason?: string;
        comment?: string;
    }): Promise<Deal | null>;
    resetDeal(dealId: number): Promise<Deal | null>;
    moveDealToStage(dealId: number, userId: number, toStageId: number, note?: string): Promise<any>;
    closeDeal(dealId: number, userId: number, status: 'WON' | 'LOST', lostReason?: string): Promise<Deal | null>;
    deleteDeal(dealId: number, userId: number): Promise<boolean>;
    getRottenDeals(userId: number, pipelineId?: number): Promise<any[]>;
    removeLabelFromDeal(dealId: number, labelId: number): Promise<Deal | null>;
}
export {};
//# sourceMappingURL=dealService.d.ts.map