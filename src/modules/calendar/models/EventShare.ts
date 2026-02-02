import { prisma } from '../../../shared/prisma';

export interface EventShare {
    id: number;
    eventId: number;
    sharedWithUserId: number;
    participantType: 'user' | 'person';
    createdAt: string;
}

export class EventShareModel {
    constructor(_db?: any) { }

    initialize(): void {
        // No-op with Prisma
    }

    private mapPrismaToShare(share: any): EventShare {
        return {
            id: share.id,
            eventId: share.eventId,
            sharedWithUserId: share.sharedWithUserId,
            participantType: share.participantType as 'user' | 'person',
            createdAt: share.createdAt.toISOString()
        };
    }

    async share(eventId: number, sharedWithUserId: number, participantType: 'user' | 'person' = 'user'): Promise<EventShare | null> {
        try {
            const share = await prisma.eventShare.upsert({
                where: {
                    eventId_sharedWithUserId_participantType: {
                        eventId,
                        sharedWithUserId,
                        participantType
                    }
                },
                update: {},
                create: {
                    eventId,
                    sharedWithUserId,
                    participantType
                }
            });
            return this.mapPrismaToShare(share);
        } catch (error) {
            console.error('Error sharing event:', error);
            throw error;
        }
    }

    async findById(id: number): Promise<EventShare | null> {
        const share = await prisma.eventShare.findUnique({
            where: { id }
        });
        return share ? this.mapPrismaToShare(share) : null;
    }

    async findByEventAndParticipant(eventId: number, sharedWithUserId: number, participantType: string): Promise<EventShare | null> {
        const share = await prisma.eventShare.findUnique({
            where: {
                eventId_sharedWithUserId_participantType: {
                    eventId,
                    sharedWithUserId,
                    participantType
                }
            }
        });
        return share ? this.mapPrismaToShare(share) : null;
    }

    async findByEventId(eventId: number): Promise<EventShare[]> {
        const shares = await prisma.eventShare.findMany({
            where: { eventId }
        });

        return shares.map((s: any) => this.mapPrismaToShare(s));
    }

    async findSharedWithUser(userId: number): Promise<EventShare[]> {
        const shares = await prisma.eventShare.findMany({
            where: { sharedWithUserId: userId, participantType: 'user' }
        });

        return shares.map((s: any) => this.mapPrismaToShare(s));
    }

    async getSharedUserIds(eventId: number): Promise<number[]> {
        const shares = await prisma.eventShare.findMany({
            where: { eventId, participantType: 'user' },
            select: { sharedWithUserId: true }
        });

        return shares.map((s: any) => s.sharedWithUserId);
    }

    async unshare(eventId: number, sharedWithUserId: number, participantType: string = 'user'): Promise<boolean> {
        try {
            await prisma.eventShare.delete({
                where: {
                    eventId_sharedWithUserId_participantType: {
                        eventId,
                        sharedWithUserId,
                        participantType
                    }
                }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async unshareAll(eventId: number): Promise<boolean> {
        try {
            await prisma.eventShare.deleteMany({
                where: { eventId }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async isSharedWith(eventId: number, userId: number, type: string = 'user'): Promise<boolean> {
        const count = await prisma.eventShare.count({
            where: {
                eventId,
                sharedWithUserId: userId,
                participantType: type
            }
        });

        return count > 0;
    }

    async getSharedUsersDetails(eventId: number): Promise<{ id: number, name: string, email: string, type: string }[]> {
        const shares = await prisma.eventShare.findMany({
            where: { eventId, participantType: 'user' }
        });

        const userIds = shares.map((s: any) => s.sharedWithUserId);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true }
        });

        return users.map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            type: 'user'
        }));
    }
}
