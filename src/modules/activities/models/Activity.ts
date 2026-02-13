import { PrismaClient } from '@prisma/client';
import { prisma as prismaInstance } from '../../../shared/prisma';
import { BaseEntity } from '../../../shared/types';
import { v4 as uuidv4 } from 'uuid';

export interface Activity extends Omit<BaseEntity, 'id'> {
    id: string; // UUID
    companyId: number;
    title: string;
    description?: string;
    type: 'call' | 'meeting' | 'task' | 'deadline' | 'email' | 'lunch';
    startAt: string; // ISO8601 UTC
    endAt: string; // ISO8601 UTC
    priority: 'low' | 'medium' | 'high';
    status: 'busy' | 'free';
    isDone: boolean;
    location?: string;
    videoCallLink?: string;
    createdBy: number;
    assignedUserIds: number[]; // Array of user IDs
    assignedUsers?: { id: number; name: string; email: string }[]; // Enriched user data
    createdAt: string;
    updatedAt: string;
}

export class ActivityModel {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient = prismaInstance) {
        this.prisma = prisma;
    }

    async initialize() {
        // No longer needed for Prisma, but kept for compatibility during transition
        console.log('ActivityModel initialized with Prisma');
    }

    async create(data: Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Activity> {
        const activity = await this.prisma.activity.create({
            data: {
                id: uuidv4(),
                companyId: data.companyId,
                title: data.title,
                description: data.description,
                type: data.type,
                startAt: new Date(data.startAt),
                endAt: new Date(data.endAt),
                priority: data.priority,
                status: data.status,
                isDone: data.isDone,
                location: data.location,
                videoCallLink: data.videoCallLink,
                createdBy: data.createdBy,
                assignedUserIds: data.assignedUserIds as any,
            }
        });

        return this.formatActivity(activity);
    }

    async findById(id: string, companyId: number): Promise<Activity | undefined> {
        const activity = await this.prisma.activity.findFirst({
            where: { id, companyId }
        });
        if (!activity) return undefined;

        return this.formatActivity(activity);
    }

    async findAll(companyId: number, filters: {
        fromDate?: string;
        toDate?: string;
        status?: 'done' | 'pending' | 'all';
        userId?: number;
        limit?: number;
        offset?: number;
    }): Promise<{ activities: Activity[], total: number }> {
        const where: any = { companyId };

        if (filters.fromDate) {
            where.startAt = { gte: new Date(filters.fromDate) };
        }

        if (filters.toDate) {
            where.startAt = { ...where.startAt, lte: new Date(filters.toDate) };
        }

        if (filters.status === 'done') {
            where.isDone = true;
        } else if (filters.status === 'pending') {
            where.isDone = false;
        }

        const activities = await this.prisma.activity.findMany({
            where,
            orderBy: { startAt: 'asc' },
            skip: filters.offset,
            take: filters.limit,
        });

        let result = activities.map(a => this.formatActivity(a));

        if (filters.userId) {
            result = result.filter(a =>
                a.createdBy === filters.userId || (a.assignedUserIds as number[]).includes(filters.userId!)
            );
        }

        const total = await this.prisma.activity.count({ where });

        return { activities: result, total };
    }

    async search(userId: number, companyId: number, query?: string, type?: string): Promise<Activity[]> {
        const where: any = {
            companyId,
            OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } }
            ]
        };

        if (type) {
            where.type = type;
        }

        const activities = await this.prisma.activity.findMany({
            where,
            orderBy: { startAt: 'desc' },
        });

        return activities
            .map(a => this.formatActivity(a))
            .filter(a => a.createdBy === userId || (a.assignedUserIds as number[]).includes(userId));
    }

    async update(id: string, companyId: number, data: Partial<Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>>): Promise<Activity | null> {
        const updateData: any = { ...data };

        if (data.startAt) updateData.startAt = new Date(data.startAt);
        if (data.endAt) updateData.endAt = new Date(data.endAt);
        if (data.assignedUserIds) updateData.assignedUserIds = data.assignedUserIds as any;

        const activity = await this.prisma.activity.update({
            where: { id, companyId },
            data: updateData
        });

        return this.formatActivity(activity);
    }

    async delete(id: string, companyId: number): Promise<boolean> {
        try {
            await this.prisma.activity.delete({
                where: { id, companyId }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async findOverlapping(companyId: number, startAt: string, endAt: string, userIds: number[]): Promise<Activity[]> {
        const activities = await this.prisma.activity.findMany({
            where: {
                companyId,
                status: 'busy',
                isDone: false,
                startAt: { lt: new Date(endAt) },
                endAt: { gt: new Date(startAt) }
            }
        });

        const formatted = activities.map(a => this.formatActivity(a));

        return formatted.filter(activity => {
            const usersInvolved = [activity.createdBy, ...(activity.assignedUserIds as number[])];
            return userIds.some(uid => usersInvolved.includes(uid));
        });
    }

    private formatActivity(result: any): Activity {
        return {
            ...result,
            startAt: result.startAt.toISOString(),
            endAt: result.endAt.toISOString(),
            createdAt: result.createdAt.toISOString(),
            updatedAt: result.updatedAt.toISOString(),
            assignedUserIds: result.assignedUserIds || []
        };
    }
}
