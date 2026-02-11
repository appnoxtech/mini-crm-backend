import { prisma } from '../../../shared/prisma';
import { BaseEntity } from '../../../shared/types';
import { Prisma } from '@prisma/client';

export interface DealActivity extends BaseEntity {
    dealId: number;
    userId: number;
    activityType: string;
    subject?: string;
    label?: string;
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    priority?: 'low' | 'medium' | 'high' | "none";
    busyFree?: 'busy' | 'free' | 'notSet';
    note?: string;
    organization?: string;
    email?: {
        from: string;
        to: string[];
        cc?: string[];
        bcc?: string[];
        subject: string;
        body: string;
        htmlBody?: string;
        attachments?: {
            filename: string;
            url: string;
            size?: number;
            mimeType?: string;
        }[];
    }
    files?: {
        url: string;
    }[];
    participants?: {
        id: number;
        name: string;
        email?: string;
        phone?: string;
    }[];
    deal?: {
        name?: string;
        value?: string;
    };
    persons?: {
        id?: number;
        name?: string;
        email?: string;
        phone?: string;
    }[];
    mataData?: {
        key?: string;
        value?: string;
        type?: string;
    }[];
    isDone: boolean;
    completedAt?: string;
}

export class DealActivityModel {
    constructor() { }

    initialize() { }

    async create(data: Omit<DealActivity, 'id' | 'createdAt' | 'updatedAt'>): Promise<DealActivity> {
        const activity = await prisma.dealActivity.create({
            data: {
                dealId: data.dealId,
                userId: data.userId,
                activityType: data.activityType,
                subject: data.subject || null,
                label: data.label || null,
                startDate: data.startDate || null,
                endDate: data.endDate || null,
                startTime: data.startTime || null,
                endTime: data.endTime || null,
                priority: data.priority || null,
                busyFree: data.busyFree || null,
                note: data.note || null,
                organization: data.organization || null,
                email: data.email ? (data.email as any) : (Prisma as any).JsonNull,
                files: data.files ? (data.files as any) : (Prisma as any).JsonNull,
                participants: data.participants ? (data.participants as any) : (Prisma as any).JsonNull,
                deal: data.deal ? (data.deal as any) : (Prisma as any).JsonNull,
                persons: data.persons ? (data.persons as any) : (Prisma as any).JsonNull,
                mataData: data.mataData ? (data.mataData as any) : (Prisma as any).JsonNull,
                isDone: data.isDone || false,
                completedAt: data.completedAt ? new Date(data.completedAt) : null,
            }
        });

        // Update deal's lastActivityAt
        await prisma.deal.update({
            where: { id: data.dealId },
            data: { lastActivityAt: new Date() }
        });

        return this.formatActivity(activity);
    }

    private formatActivity(result: any): DealActivity {
        return {
            id: result.id,
            dealId: result.dealId,
            userId: result.userId,
            activityType: result.activityType,
            subject: result.subject || undefined,
            label: result.label || undefined,
            startDate: result.startDate || undefined,
            endDate: result.endDate || undefined,
            startTime: result.startTime || undefined,
            endTime: result.endTime || undefined,
            priority: result.priority as any,
            busyFree: result.busyFree as any,
            note: result.note || undefined,
            organization: result.organization || undefined,
            isDone: result.isDone,
            completedAt: result.completedAt?.toISOString() || undefined,
            createdAt: result.createdAt.toISOString(),
            updatedAt: result.updatedAt.toISOString(),
            email: result.email || undefined,
            participants: result.participants || [],
            deal: result.deal || {},
            files: result.files || [],
            persons: result.persons || [],
            mataData: result.mataData || []
        };
    }

    async findById(id: number): Promise<DealActivity | null> {
        const result = await prisma.dealActivity.findUnique({
            where: { id }
        });
        if (!result) return null;
        return this.formatActivity(result);
    }

    async findByDealId(dealId: number, filters: {
        activityType?: string;
        isDone?: boolean;
        limit?: number;
    } = {}): Promise<DealActivity[]> {
        const where: any = { dealId };

        if (filters.activityType) {
            where.activityType = filters.activityType;
        }

        if (filters.isDone !== undefined) {
            where.isDone = filters.isDone;
        }

        const results = await prisma.dealActivity.findMany({
            where,
            orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
            take: filters.limit
        });

        return results.map((r: any) => this.formatActivity(r));
    }

    async createNoteActivity(userId: number, dealId: number, note: string): Promise<DealActivity> {
        return this.create({
            userId,
            dealId,
            activityType: 'note',
            note,
            isDone: false
        });
    }

    async createFileActivity(userId: number, dealId: number, files: any[]): Promise<DealActivity> {
        return this.create({
            userId,
            dealId,
            activityType: 'file',
            files,
            isDone: false
        });
    }

    async findByUserId(userId: number, filters: {
        activityType?: string;
        isDone?: boolean;
        upcoming?: boolean;
        limit?: number;
    } = {}): Promise<DealActivity[]> {
        const where: any = { userId };

        if (filters.activityType) {
            where.activityType = filters.activityType;
        }

        if (filters.isDone !== undefined) {
            where.isDone = filters.isDone;
        }

        if (filters.upcoming) {
            const today = new Date().toISOString().split('T')[0];
            where.startDate = { gte: today };
            where.isDone = false;
        }

        const results = await prisma.dealActivity.findMany({
            where,
            orderBy: [{ startDate: 'asc' }, { createdAt: 'desc' }],
            take: filters.limit
        });

        return results.map((r: any) => this.formatActivity(r));
    }

    async search(userId: number, query: string, dealId?: number): Promise<DealActivity[]> {
        const where: any = {
            userId,
            OR: [
                { subject: { contains: query, mode: 'insensitive' } },
                { note: { contains: query, mode: 'insensitive' } }
            ]
        };

        if (dealId) {
            where.dealId = dealId;
        }

        const results = await prisma.dealActivity.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        return results.map((r: any) => this.formatActivity(r));
    }


    async update(
        id: number,
        data: Partial<Omit<DealActivity, 'id' | 'dealId' | 'userId' | 'createdAt' | 'updatedAt'>>
    ): Promise<DealActivity | null> {
        const activity = await this.findById(id);
        if (!activity) return null;

        const updateData: any = {
            ...(data.activityType !== undefined && { activityType: data.activityType }),
            ...(data.subject !== undefined && { subject: data.subject }),
            ...(data.label !== undefined && { label: data.label }),
            ...(data.startDate !== undefined && { startDate: data.startDate }),
            ...(data.endDate !== undefined && { endDate: data.endDate }),
            ...(data.startTime !== undefined && { startTime: data.startTime }),
            ...(data.endTime !== undefined && { endTime: data.endTime }),
            ...(data.priority !== undefined && { priority: data.priority }),
            ...(data.busyFree !== undefined && { busyFree: data.busyFree }),
            ...(data.note !== undefined && { note: data.note }),
            ...(data.organization !== undefined && { organization: data.organization }),
            ...(data.email !== undefined && { email: data.email as any }),
            ...(data.files !== undefined && { files: data.files as any }),
            ...(data.participants !== undefined && { participants: data.participants as any }),
            ...(data.deal !== undefined && { deal: data.deal as any }),
            ...(data.persons !== undefined && { persons: data.persons as any }),
            ...(data.mataData !== undefined && { mataData: data.mataData as any }),
            ...(data.isDone !== undefined && { isDone: data.isDone }),
            ...(data.completedAt !== undefined && { completedAt: data.completedAt ? new Date(data.completedAt) : null }),
            updatedAt: new Date()
        };

        const updated = await prisma.dealActivity.update({
            where: { id },
            data: updateData
        });

        // Update deal's lastActivityAt
        await prisma.deal.update({
            where: { id: activity.dealId },
            data: { lastActivityAt: new Date() }
        });

        return this.formatActivity(updated);
    }

    async markAsComplete(id: number): Promise<DealActivity | null> {
        const now = new Date();
        const updated = await prisma.dealActivity.update({
            where: { id },
            data: {
                isDone: true,
                completedAt: now,
                updatedAt: now
            }
        });

        if (updated) {
            await prisma.deal.update({
                where: { id: updated.dealId },
                data: { lastActivityAt: now }
            });
        }

        return this.formatActivity(updated);
    }

    async delete(id: number): Promise<boolean> {
        try {
            await prisma.dealActivity.delete({
                where: { id }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async addActivityNote(userId: number, activityId: number, note: string): Promise<DealActivity | null> {
        return this.update(activityId, { note });
    }

    async getUpcomingActivities(userId: number, days: number = 7): Promise<DealActivity[]> {
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + days);

        const results = await prisma.dealActivity.findMany({
            where: {
                userId,
                isDone: false,
                startDate: {
                    gte: today.toISOString().split('T')[0],
                    lte: futureDate.toISOString().split('T')[0]
                }
            },
            orderBy: [{ startDate: 'asc' }, { startTime: 'asc' }]
        });

        return results.map((r: any) => this.formatActivity(r));
    }
}
