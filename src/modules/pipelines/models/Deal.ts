import { prisma } from '../../../shared/prisma';
import { BaseEntity } from '../../../shared/types';
import { Prisma } from '@prisma/client';

export interface Deal extends BaseEntity {
    title: string;
    companyId: number;
    value: number;
    currency: string;
    pipelineId: number;
    stageId: number;
    personId?: number;
    organizationId?: number;
    email?: { value: string; type: string }[];
    phone?: { value: string; type: string }[];

    description?: string;
    expectedCloseDate?: string;
    actualCloseDate?: string;
    probability: number;

    userId: number;
    assignedTo?: number;
    ownerIds?: number[];
    isVisibleToAll?: boolean;

    status: 'OPEN' | 'WON' | 'LOST' | 'DELETED';
    lostReason?: string;
    lastActivityAt?: string;
    isRotten: boolean;
    labelIds?: number[];
    source?: string;
    customFields?: any;
    deletedAt?: string;
    archivedAt?: string;
}

export class DealModel {
    constructor() { }

    initialize(): void { }

    async create(data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'isRotten'>): Promise<Deal> {
        const deal = await prisma.deal.create({
            data: {
                title: data.title,
                companyId: data.companyId,
                value: data.value || 0,
                currency: data.currency || 'USD',
                pipelineId: data.pipelineId,
                stageId: data.stageId,
                email: (data.email as any) || (Prisma as any).JsonNull,
                phone: (data.phone as any) || (Prisma as any).JsonNull,
                description: data.description || null,
                expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
                actualCloseDate: data.actualCloseDate ? new Date(data.actualCloseDate) : null,
                probability: data.probability || 0,
                userId: data.userId,
                assignedTo: data.assignedTo || null,
                status: data.status || 'OPEN',
                lostReason: data.lostReason || null,
                personId: data.personId || null,
                organizationId: data.organizationId || null,
                source: data.source || null,
                labelIds: (data.labelIds as any) || (Prisma as any).JsonNull,
                customFields: (data.customFields as any) || (Prisma as any).JsonNull,
                ownerIds: (data.ownerIds as any) || [data.userId],
                isVisibleToAll: data.isVisibleToAll ?? true,
                isRotten: false
            }
        });

        return this.mapPrismaDealToDeal(deal);
    }

    async findById(id: number, companyId: number, userId?: number): Promise<Deal | null> {
        const deal = await prisma.deal.findFirst({
            where: { id, companyId }
        });
        if (!deal) return null;
        if (userId && deal.userId !== userId && !((deal.ownerIds as number[]) || []).includes(userId) && !deal.isVisibleToAll) {
            return null;
        }
        return this.mapPrismaDealToDeal(deal);
    }

    async findByUserId(userId: number, companyId: number, options: {
        pipelineId?: number;
        stageId?: number;
        status?: string;
        limit?: number;
        offset?: number;
        search?: string;
    } = {}): Promise<{ deals: Deal[]; total: number }> {
        const where: any = {
            companyId,
            deletedAt: null,
            archivedAt: null,
            OR: [
                { userId },
                {
                    ownerIds: {
                        array_contains: userId
                    }
                },
                { isVisibleToAll: true }
            ]
        };

        if (options.pipelineId) where.pipelineId = options.pipelineId;
        if (options.stageId) where.stageId = options.stageId;
        if (options.status && options.status !== 'all') where.status = options.status.toUpperCase();

        if (options.search) {
            where.AND = [
                {
                    OR: [
                        { title: { contains: options.search, mode: 'insensitive' } },
                        { description: { contains: options.search, mode: 'insensitive' } }
                    ]
                }
            ];
        }

        const [deals, total] = await Promise.all([
            prisma.deal.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: options.limit,
                skip: options.offset || 0,
                include: {
                    pipeline: true,
                    stage: true
                }
            }),
            prisma.deal.count({ where })
        ]);

        return {
            deals: deals.map((d: any) => this.mapPrismaDealToDeal(d)),
            total
        };
    }

    async searchDeals(userId: number, companyId: number, search: string, includeDeleted: boolean = false): Promise<Deal[]> {
        const where: any = {
            companyId,
            OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } }
            ]
        };

        if (!includeDeleted) {
            where.deletedAt = null;
        }

        const deals = await prisma.deal.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 50
        });

        return deals.map((d: any) => this.mapPrismaDealToDeal(d));
    }

    async update(id: number, companyId: number, userId: number, data: Partial<Deal>): Promise<Deal | null> {
        try {
            const updateData: any = {
                ...(data.title !== undefined && { title: data.title }),
                ...(data.value !== undefined && { value: data.value }),
                ...(data.currency !== undefined && { currency: data.currency }),
                ...(data.pipelineId !== undefined && { pipelineId: data.pipelineId }),
                ...(data.stageId !== undefined && { stageId: data.stageId }),
                ...(data.email !== undefined && { email: data.email as any }),
                ...(data.phone !== undefined && { phone: data.phone as any }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.expectedCloseDate !== undefined && { expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null }),
                ...(data.actualCloseDate !== undefined && { actualCloseDate: data.actualCloseDate ? new Date(data.actualCloseDate) : null }),
                ...(data.probability !== undefined && { probability: data.probability }),
                ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
                ...(data.status !== undefined && { status: data.status }),
                ...(data.lostReason !== undefined && { lostReason: data.lostReason }),
                ...(data.personId !== undefined && { personId: data.personId }),
                ...(data.organizationId !== undefined && { organizationId: data.organizationId }),
                ...(data.source !== undefined && { source: data.source }),
                ...(data.labelIds !== undefined && { labelIds: data.labelIds as any }),
                ...(data.customFields !== undefined && { customFields: data.customFields as any }),
                ...(data.ownerIds !== undefined && { ownerIds: data.ownerIds as any }),
                ...(data.isVisibleToAll !== undefined && { isVisibleToAll: data.isVisibleToAll }),
                ...(data.lastActivityAt !== undefined && { lastActivityAt: new Date(data.lastActivityAt) }),
                updatedAt: new Date()
            };

            const deal = await prisma.deal.update({
                where: { id, companyId },
                data: updateData
            });

            return this.mapPrismaDealToDeal(deal);
        } catch (error) {
            return null;
        }
    }

    async makeDealAsWon(id: number, companyId: number): Promise<Deal | null> {
        return this.update(id, companyId, 0, { status: 'WON', actualCloseDate: new Date().toISOString() });
    }

    async makeDealAsLost(id: number, companyId: number, info: { reason?: string, comment?: string }): Promise<Deal | null> {
        return this.update(id, companyId, 0, {
            status: 'LOST',
            actualCloseDate: new Date().toISOString(),
            lostReason: info.reason || info.comment
        });
    }

    async resetDeal(id: number, companyId: number): Promise<Deal | null> {
        return this.update(id, companyId, 0, { status: 'OPEN', actualCloseDate: undefined, lostReason: undefined });
    }

    async delete(id: number, companyId: number, userId: number): Promise<boolean> {
        try {
            await prisma.deal.update({
                where: { id, companyId },
                data: { deletedAt: new Date() }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async archive(ids: number[], companyId: number, userId: number): Promise<boolean> {
        try {
            await prisma.deal.updateMany({
                where: { id: { in: ids }, companyId },
                data: { archivedAt: new Date() }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async unarchive(ids: number[], companyId: number, userId: number): Promise<boolean> {
        try {
            await prisma.deal.updateMany({
                where: { id: { in: ids }, companyId },
                data: { archivedAt: null }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async getArchivedDeals(userId: number, companyId: number, options: {
        pipelineId?: number;
        stageId?: number;
        limit?: number;
        offset?: number;
    } = {}): Promise<{ deals: Deal[]; total: number }> {
        const where: any = {
            companyId,
            archivedAt: { not: null },
            deletedAt: null,
            userId
        };

        if (options.pipelineId) where.pipelineId = options.pipelineId;
        if (options.stageId) where.stageId = options.stageId;

        const [deals, total] = await Promise.all([
            prisma.deal.findMany({
                where,
                orderBy: { archivedAt: 'desc' },
                take: options.limit,
                skip: options.offset || 0
            }),
            prisma.deal.count({ where })
        ]);

        return {
            deals: deals.map((d: any) => this.mapPrismaDealToDeal(d)),
            total
        };
    }

    async hardDeleteArchived(ids: number[], companyId: number, userId: number): Promise<boolean> {
        try {
            await prisma.deal.deleteMany({
                where: { id: { in: ids }, companyId, archivedAt: { not: null }, userId }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async getRottenDeals(userId: number, companyId: number, pipelineId?: number): Promise<Deal[]> {
        const where: any = {
            companyId,
            isRotten: true,
            deletedAt: null,
            userId
        };
        if (pipelineId) where.pipelineId = pipelineId;

        const deals = await prisma.deal.findMany({ where });
        return deals.map((d: any) => this.mapPrismaDealToDeal(d));
    }

    async removeLabelFromDeal(dealId: number, companyId: number, labelId: number): Promise<Deal | null> {
        const deal = await prisma.deal.findFirst({ where: { id: dealId, companyId } });
        if (!deal) return null;

        const labels = (deal.labelIds as number[]) || [];
        const updatedLabels = labels.filter(id => id !== labelId);

        const updated = await prisma.deal.update({
            where: { id: dealId, companyId },
            data: { labelIds: updatedLabels as any }
        });

        return this.mapPrismaDealToDeal(updated);
    }

    async getStats(userId: number, companyId: number): Promise<any> {
        const stats = await prisma.deal.groupBy({
            by: ['status'],
            where: {
                companyId,
                deletedAt: null,
                OR: [
                    { userId },
                    {
                        ownerIds: {
                            array_contains: userId
                        }
                    }
                ]
            },
            _count: { _all: true },
            _sum: { value: true }
        });

        const result = {
            total: 0,
            open: 0,
            won: 0,
            lost: 0,
            totalValue: 0,
            wonValue: 0
        };

        stats.forEach((s: any) => {
            const count = s._count._all;
            const sum = s._sum.value || 0;
            result.total += count;
            result.totalValue += sum;
            if (s.status === 'OPEN') result.open = count;
            else if (s.status === 'WON') {
                result.won = count;
                result.wonValue = sum;
            } else if (s.status === 'LOST') result.lost = count;
        });

        return result;
    }

    async searchByTitle(title: string, companyId: number): Promise<Deal[]> {
        const deals = await prisma.deal.findMany({
            where: {
                companyId,
                title: { contains: title, mode: 'insensitive' },
                deletedAt: null
            },
            take: 50
        });
        return deals.map((d: any) => this.mapPrismaDealToDeal(d));
    }

    async findExistingByTitle(title: string, companyId: number): Promise<{ dealId: number; title: string } | null> {
        const deal = await prisma.deal.findFirst({
            where: {
                companyId,
                title: { equals: title, mode: 'insensitive' },
                deletedAt: null
            },
            select: { id: true, title: true }
        });
        return deal ? { dealId: deal.id, title: deal.title } : null;
    }

    async hardDelete(id: number, companyId: number): Promise<boolean> {
        try {
            await prisma.deal.delete({
                where: { id, companyId }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    private mapPrismaDealToDeal(d: any): Deal {
        return {
            id: d.id,
            companyId: d.companyId,
            title: d.title,
            value: d.value || 0,
            currency: d.currency || 'USD',
            pipelineId: d.pipelineId,
            stageId: d.stageId,
            personId: d.personId || undefined,
            organizationId: d.organizationId || undefined,
            email: (d.email as any) || undefined,
            phone: (d.phone as any) || undefined,
            description: d.description || undefined,
            expectedCloseDate: d.expectedCloseDate?.toISOString() || undefined,
            actualCloseDate: d.actualCloseDate?.toISOString() || undefined,
            probability: d.probability || 0,
            userId: d.userId,
            assignedTo: d.assignedTo || undefined,
            ownerIds: (d.ownerIds as number[]) || [],
            isVisibleToAll: d.isVisibleToAll,
            status: (d.status as any) || 'OPEN',
            lostReason: d.lostReason || undefined,
            lastActivityAt: d.lastActivityAt?.toISOString() || undefined,
            isRotten: d.isRotten,
            labelIds: (d.labelIds as number[]) || [],
            source: d.source || undefined,
            customFields: d.customFields || undefined,
            createdAt: d.createdAt.toISOString(),
            updatedAt: d.updatedAt.toISOString(),
            deletedAt: d.deletedAt?.toISOString() || undefined,
            archivedAt: d.archivedAt?.toISOString() || undefined
        };
    }
}