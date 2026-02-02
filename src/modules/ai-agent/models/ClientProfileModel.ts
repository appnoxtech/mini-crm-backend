import { prisma } from '../../../shared/prisma';

export interface ClientProfile {
    id?: string;
    dealId?: number;
    personId?: number;
    organizationId?: number;
    requirements?: string[];
    budgetMin?: number;
    budgetMax?: number;
    timeline?: string;
    decisionMakers?: string[];
    objections?: string[];
    preferences?: any;
    relationshipStage?: string;
    maturityScore?: number;
    lastUpdated?: string;
}

export class ClientProfileModel {
    constructor(_db?: any) { }

    private mapPrismaToProfile(p: any): ClientProfile {
        return {
            id: p.id,
            dealId: p.dealId || undefined,
            personId: p.personId || undefined,
            organizationId: p.organizationId || undefined,
            requirements: p.requirements ? (typeof p.requirements === 'string' ? JSON.parse(p.requirements) : p.requirements) : [],
            budgetMin: p.budgetMin || undefined,
            budgetMax: p.budgetMax || undefined,
            timeline: p.timeline || undefined,
            decisionMakers: p.decisionMakers ? (typeof p.decisionMakers === 'string' ? JSON.parse(p.decisionMakers) : p.decisionMakers) : [],
            objections: p.objections ? (typeof p.objections === 'string' ? JSON.parse(p.objections) : p.objections) : [],
            preferences: p.preferences ? (typeof p.preferences === 'string' ? JSON.parse(p.preferences) : p.preferences) : {},
            relationshipStage: p.relationshipStage || undefined,
            maturityScore: p.maturityScore || undefined,
            lastUpdated: p.lastUpdated.toISOString()
        };
    }

    async findByDealId(dealId: number): Promise<ClientProfile | null> {
        const profile = await prisma.clientProfile.findFirst({
            where: { dealId }
        });
        return profile ? this.mapPrismaToProfile(profile) : null;
    }

    async findByPersonId(personId: number): Promise<ClientProfile | null> {
        const profile = await prisma.clientProfile.findFirst({
            where: { personId }
        });
        return profile ? this.mapPrismaToProfile(profile) : null;
    }

    async upsertProfile(data: ClientProfile): Promise<void> {
        const where: any = {};
        if (data.dealId) where.dealId = data.dealId;
        else if (data.personId) where.personId = data.personId;
        else if (data.organizationId) where.organizationId = data.organizationId;
        else throw new Error('Deal ID, Person ID, or Organization ID required for client profile');

        const existing = await prisma.clientProfile.findFirst({ where });

        const profileData: any = {
            dealId: data.dealId || null,
            personId: data.personId || null,
            organizationId: data.organizationId || null,
            requirements: data.requirements || [],
            budgetMin: data.budgetMin || null,
            budgetMax: data.budgetMax || null,
            timeline: data.timeline || null,
            decisionMakers: data.decisionMakers || [],
            objections: data.objections || [],
            preferences: data.preferences || {},
            relationshipStage: data.relationshipStage || null,
            maturityScore: data.maturityScore || null
        };

        if (existing) {
            await prisma.clientProfile.update({
                where: { id: existing.id },
                data: profileData
            });
        } else {
            await prisma.clientProfile.create({
                data: profileData
            });
        }
    }
}
