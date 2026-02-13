import { prisma } from '../../../shared/prisma';
import { BaseEntity } from '../../../shared/types';
import { Prisma } from '@prisma/client';

export type CallDirection = 'inbound' | 'outbound';
export type CallStatus =
    | 'initiated'
    | 'ringing'
    | 'in-progress'
    | 'completed'
    | 'busy'
    | 'no-answer'
    | 'failed'
    | 'canceled'
    | 'voicemail';

export type CallDisposition =
    | 'connected'
    | 'left-voicemail'
    | 'no-answer'
    | 'busy'
    | 'wrong-number'
    | 'callback-requested'
    | 'not-interested'
    | 'interested'
    | 'follow-up-scheduled'
    | 'other';

export interface Call extends BaseEntity {
    id: number;
    companyId: number;
    twilioCallSid: string;
    twilioAccountSid: string;
    direction: CallDirection;
    status: CallStatus;
    fromNumber: string;
    toNumber: string;
    startTime?: string;
    answerTime?: string;
    endTime?: string;
    duration: number;
    ringDuration?: number;
    userId: number;
    contactId?: number;
    dealId?: number;
    leadId?: number;
    disposition?: CallDisposition;
    notes?: string;
    summary?: string;
    queueName?: string;
    assignedAgentId?: number;
    deletedAt?: string;
}

export interface CallParticipant extends BaseEntity {
    id: number;
    callId: number;
    companyId: number;
    participantSid?: string;
    phoneNumber: string;
    name?: string;
    role: 'caller' | 'callee' | 'transfer' | 'conference';
    joinTime?: string;
    leaveTime?: string;
    muted: boolean;
    hold: boolean;
}

export interface CallRecording extends BaseEntity {
    id: number;
    callId: number;
    companyId: number;
    recordingSid: string;
    recordingUrl?: string;
    localFilePath?: string;
    duration: number;
    fileSize?: number;
    channels: number;
    status: 'processing' | 'completed' | 'failed' | 'deleted';
    transcriptionSid?: string;
    transcriptionText?: string;
    transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
    transcriptionUrl?: string;
}

export interface CallEvent extends BaseEntity {
    id: number;
    callId: number;
    companyId: number;
    eventType: string;
    eventData?: string;
    triggeredBy?: number;
}

export class CallModel {
    constructor(_db?: any) { }

    initialize(): void {
        // No-op with Prisma
    }

    async createCall(callData: Omit<Call, 'id' | 'createdAt' | 'updatedAt' | 'duration'>): Promise<Call> {
        const call = await prisma.call.create({
            data: {
                companyId: callData.companyId,
                twilioCallSid: callData.twilioCallSid,
                twilioAccountSid: callData.twilioAccountSid,
                direction: callData.direction,
                status: callData.status,
                fromNumber: callData.fromNumber,
                toNumber: callData.toNumber,
                startTime: callData.startTime ? new Date(callData.startTime) : new Date(),
                answerTime: callData.answerTime ? new Date(callData.answerTime) : null,
                endTime: callData.endTime ? new Date(callData.endTime) : null,
                duration: 0,
                ringDuration: callData.ringDuration || null,
                userId: callData.userId,
                contactId: callData.contactId || null,
                dealId: callData.dealId || null,
                leadId: callData.leadId || null,
                disposition: callData.disposition || null,
                notes: callData.notes || null,
                summary: callData.summary || null,
                queueName: callData.queueName || null,
                assignedAgentId: callData.assignedAgentId || null
            }
        });

        const formatted = this.mapPrismaCallToCall(call);
        await this.addEvent(formatted.id, formatted.companyId, 'call-initiated', JSON.stringify({ status: 'initiated', direction: callData.direction }));
        return formatted;
    }

    async findById(id: number, companyId: number): Promise<Call | null> {
        const call = await prisma.call.findFirst({
            where: { id, companyId, deletedAt: null }
        });
        return call ? this.mapPrismaCallToCall(call) : null;
    }

    async findByTwilioSid(twilioCallSid: string, companyId: number): Promise<Call | null> {
        const where: any = { twilioCallSid, companyId, deletedAt: null };

        const call = await prisma.call.findFirst({
            where
        });
        return call ? this.mapPrismaCallToCall(call) : null;
    }

    async findByTwilioSidGlobal(twilioCallSid: string): Promise<Call | null> {
        const call = await prisma.call.findFirst({
            where: { twilioCallSid, deletedAt: null }
        });
        return call ? this.mapPrismaCallToCall(call) : null;
    }

    async findByUserId(userId: number, companyId: number, options: {
        direction?: CallDirection;
        status?: CallStatus;
        contactId?: number;
        dealId?: number;
        startDate?: string;
        endDate?: string;
        search?: string;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    } = {}): Promise<{ calls: Call[]; count: number; total: number }> {
        const where: any = { userId, companyId };

        if (!options.includeDeleted) {
            where.deletedAt = null;
        }

        if (options.direction) where.direction = options.direction;
        if (options.status) where.status = options.status;
        if (options.contactId) where.contactId = options.contactId;
        if (options.dealId) where.dealId = options.dealId;

        if (options.startDate || options.endDate) {
            where.createdAt = {};
            if (options.startDate) where.createdAt.gte = new Date(options.startDate);
            if (options.endDate) where.createdAt.lte = new Date(options.endDate);
        }

        if (options.search) {
            where.OR = [
                { fromNumber: { contains: options.search } },
                { toNumber: { contains: options.search } },
                { notes: { contains: options.search } }
            ];
        }

        const [calls, count, total] = await Promise.all([
            prisma.call.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: options.limit,
                skip: options.offset || 0
            }),
            prisma.call.count({ where }),
            prisma.call.count({ where: { userId, companyId, ...(options.includeDeleted ? {} : { deletedAt: null }) } })
        ]);

        return {
            calls: calls.map((c: any) => this.mapPrismaCallToCall(c)),
            count,
            total
        };
    }

    async updateStatus(id: number, companyId: number, status: CallStatus, additionalData?: Partial<Call>): Promise<Call | null> {
        const call = await this.findById(id, companyId);
        if (!call) return null;

        const now = new Date();
        const updateData: any = {
            status,
            updatedAt: now
        };

        if (status === 'in-progress' && !call.answerTime) {
            updateData.answerTime = now;
        }

        if (['completed', 'busy', 'no-answer', 'failed', 'canceled'].includes(status)) {
            updateData.endTime = now;
            if (call.answerTime) {
                const duration = Math.floor((now.getTime() - new Date(call.answerTime).getTime()) / 1000);
                updateData.duration = duration;
            }
        }

        if (additionalData) {
            if (additionalData.disposition) updateData.disposition = additionalData.disposition;
            if (additionalData.notes !== undefined) updateData.notes = additionalData.notes;
            if (additionalData.duration !== undefined) updateData.duration = additionalData.duration;
        }

        const updated = await prisma.call.update({
            where: { id, companyId },
            data: updateData
        });

        await this.addEvent(id, companyId, 'status-change', JSON.stringify({ previousStatus: call.status, newStatus: status }));

        return this.mapPrismaCallToCall(updated);
    }

    async updateCallDetails(id: number, userId: number, companyId: number, data: { notes?: string; disposition?: CallDisposition; summary?: string }): Promise<Call | null> {
        const call = await this.findById(id, companyId);
        if (!call || call.userId !== userId) return null;

        const updated = await prisma.call.update({
            where: { id, companyId },
            data: {
                ...(data.notes !== undefined && { notes: data.notes }),
                ...(data.disposition !== undefined && { disposition: data.disposition }),
                ...(data.summary !== undefined && { summary: data.summary }),
                updatedAt: new Date()
            }
        });

        await this.addEvent(id, companyId, 'details-updated', JSON.stringify(data), userId);

        return this.mapPrismaCallToCall(updated);
    }

    async softDelete(id: number, userId: number, companyId: number): Promise<boolean> {
        try {
            await prisma.call.update({
                where: { id, userId, companyId },
                data: { deletedAt: new Date(), updatedAt: new Date() }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async addParticipant(participantData: Omit<CallParticipant, 'id' | 'createdAt' | 'updatedAt'>): Promise<CallParticipant> {
        const participant = await prisma.callParticipant.create({
            data: {
                callId: participantData.callId,
                companyId: participantData.companyId,
                participantSid: participantData.participantSid || null,
                phoneNumber: participantData.phoneNumber,
                name: participantData.name || null,
                role: participantData.role,
                joinTime: participantData.joinTime ? new Date(participantData.joinTime) : new Date(),
                leaveTime: participantData.leaveTime ? new Date(participantData.leaveTime) : null,
                muted: participantData.muted,
                hold: participantData.hold
            }
        });

        return this.mapPrismaParticipantToParticipant(participant);
    }

    async getParticipantById(id: number, companyId: number): Promise<CallParticipant | null> {
        const participant = await prisma.callParticipant.findFirst({
            where: { id, companyId }
        });
        return participant ? this.mapPrismaParticipantToParticipant(participant) : null;
    }

    async getParticipantsByCallId(callId: number, companyId: number): Promise<CallParticipant[]> {
        const participants = await prisma.callParticipant.findMany({
            where: { callId, companyId }
        });
        return participants.map((p: any) => this.mapPrismaParticipantToParticipant(p));
    }

    async addRecording(recordingData: Omit<CallRecording, 'id' | 'createdAt' | 'updatedAt'>): Promise<CallRecording> {
        const recording = await prisma.callRecording.create({
            data: {
                callId: recordingData.callId,
                companyId: recordingData.companyId,
                recordingSid: recordingData.recordingSid,
                recordingUrl: recordingData.recordingUrl || null,
                localFilePath: recordingData.localFilePath || null,
                duration: recordingData.duration || 0,
                fileSize: recordingData.fileSize || null,
                channels: recordingData.channels || 1,
                status: recordingData.status,
                transcriptionSid: recordingData.transcriptionSid || null,
                transcriptionText: recordingData.transcriptionText || null,
                transcriptionStatus: recordingData.transcriptionStatus || null,
                transcriptionUrl: recordingData.transcriptionUrl || null
            }
        });

        return this.mapPrismaRecordingToRecording(recording);
    }

    async getRecordingById(id: number, companyId: number): Promise<CallRecording | null> {
        const recording = await prisma.callRecording.findFirst({
            where: { id, companyId }
        });
        return recording ? this.mapPrismaRecordingToRecording(recording) : null;
    }

    async getRecordingByCallId(callId: number, companyId: number): Promise<CallRecording | null> {
        const recording = await prisma.callRecording.findFirst({
            where: { callId, companyId }
        });
        return recording ? this.mapPrismaRecordingToRecording(recording) : null;
    }

    async getRecordingByRecordingSid(recordingSid: string, companyId: number): Promise<CallRecording | null> {
        const where: any = { recordingSid, companyId };
        const recording = await prisma.callRecording.findFirst({
            where
        });
        return recording ? this.mapPrismaRecordingToRecording(recording) : null;
    }

    async getRecordingByRecordingSidGlobal(recordingSid: string): Promise<CallRecording | null> {
        const recording = await prisma.callRecording.findFirst({
            where: { recordingSid }
        });
        return recording ? this.mapPrismaRecordingToRecording(recording) : null;
    }

    async updateRecording(id: number, companyId: number, data: Partial<CallRecording>): Promise<CallRecording | null> {
        try {
            const updated = await prisma.callRecording.update({
                where: { id, companyId },
                data: {
                    ...(data.recordingUrl !== undefined && { recordingUrl: data.recordingUrl }),
                    ...(data.localFilePath !== undefined && { localFilePath: data.localFilePath }),
                    ...(data.duration !== undefined && { duration: data.duration }),
                    ...(data.fileSize !== undefined && { fileSize: data.fileSize }),
                    ...(data.status !== undefined && { status: data.status }),
                    ...(data.transcriptionSid !== undefined && { transcriptionSid: data.transcriptionSid }),
                    ...(data.transcriptionText !== undefined && { transcriptionText: data.transcriptionText }),
                    ...(data.transcriptionStatus !== undefined && { transcriptionStatus: data.transcriptionStatus }),
                    ...(data.transcriptionUrl !== undefined && { transcriptionUrl: data.transcriptionUrl }),
                    updatedAt: new Date()
                }
            });
            return this.mapPrismaRecordingToRecording(updated);
        } catch (error) {
            return null;
        }
    }

    async addEvent(callId: number, companyId: number, eventType: string, eventData?: string, triggeredBy?: number): Promise<CallEvent> {
        const event = await prisma.callEvent.create({
            data: {
                callId,
                companyId,
                eventType,
                eventData: eventData || null,
                triggeredBy: triggeredBy || null
            }
        });

        return this.mapPrismaEventToEvent(event);
    }

    async getEventById(id: number, companyId: number): Promise<CallEvent | null> {
        const event = await prisma.callEvent.findFirst({
            where: { id, companyId }
        });
        return event ? this.mapPrismaEventToEvent(event) : null;
    }

    async getEventsByCallId(callId: number, companyId: number): Promise<CallEvent[]> {
        const events = await prisma.callEvent.findMany({
            where: { callId, companyId },
            orderBy: { createdAt: 'desc' }
        });
        return events.map((e: any) => this.mapPrismaEventToEvent(e));
    }

    async getCallStats(userId: number, companyId: number, options: { startDate?: string; endDate?: string } = {}): Promise<any> {
        const where: any = { userId, companyId, deletedAt: null };
        if (options.startDate || options.endDate) {
            where.createdAt = {};
            if (options.startDate) where.createdAt.gte = new Date(options.startDate);
            if (options.endDate) where.createdAt.lte = new Date(options.endDate);
        }

        const calls = await prisma.call.findMany({ where });

        const stats = {
            totalCalls: calls.length,
            inboundCalls: calls.filter((c: any) => c.direction === 'inbound').length,
            outboundCalls: calls.filter((c: any) => c.direction === 'outbound').length,
            completedCalls: calls.filter((c: any) => c.status === 'completed').length,
            missedCalls: calls.filter((c: any) => ['no-answer', 'busy', 'canceled'].includes(c.status || '')).length,
            totalDuration: calls.reduce((acc: any, c: any) => acc + (c.duration || 0), 0),
            averageDuration: 0
        };

        if (stats.completedCalls > 0) {
            stats.averageDuration = Math.round(stats.totalDuration / stats.completedCalls);
        }

        return stats;
    }

    async getCallsByContactId(contactId: number, companyId: number, limit: number = 10): Promise<Call[]> {
        const calls = await prisma.call.findMany({
            where: { contactId, companyId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
        return calls.map((c: any) => this.mapPrismaCallToCall(c));
    }

    async getCallsByDealId(dealId: number, companyId: number): Promise<Call[]> {
        const calls = await prisma.call.findMany({
            where: { dealId, companyId, deletedAt: null },
            orderBy: { createdAt: 'desc' }
        });
        return calls.map((c: any) => this.mapPrismaCallToCall(c));
    }

    async findContactByPhoneNumber(phoneNumber: string, companyId: number): Promise<{ contactId: number; name: string; company?: string } | undefined> {
        const person = await prisma.person.findFirst({
            where: {
                companyId,
                OR: [
                    { phones: { path: ['$[*].number'], array_contains: phoneNumber } },
                    { phones: { path: ['$[*].number'], string_contains: phoneNumber } }
                ],
                deletedAt: null
            },
            include: { organization: true }
        });

        // Prisma doesn't support complex JSON path queries in all DBs easily, but for PostgreSQL:
        // Better to search in person_phones if we are using that model.

        if (!person) {
            const phoneResult = await prisma.personPhone.findFirst({
                where: { phone: { contains: phoneNumber }, person: { companyId } },
                include: { person: { include: { organization: true } } }
            });
            if (phoneResult) {
                return {
                    contactId: phoneResult.personId,
                    name: `${phoneResult.person.firstName} ${phoneResult.person.lastName || ''}`.trim(),
                    company: phoneResult.person.organization?.name
                };
            }
        }

        if (person) {
            return {
                contactId: person.id,
                name: `${person.firstName} ${person.lastName || ''}`.trim(),
                company: person.organization?.name
            };
        }

        return undefined;
    }

    private mapPrismaCallToCall(c: any): Call {
        return {
            id: c.id,
            companyId: c.companyId,
            twilioCallSid: c.twilioCallSid,
            twilioAccountSid: c.twilioAccountSid,
            direction: c.direction as CallDirection,
            status: c.status as CallStatus,
            fromNumber: c.fromNumber,
            toNumber: c.toNumber,
            startTime: c.startTime?.toISOString(),
            answerTime: c.answerTime?.toISOString(),
            endTime: c.endTime?.toISOString(),
            duration: c.duration,
            ringDuration: c.ringDuration || undefined,
            userId: c.userId,
            contactId: c.contactId || undefined,
            dealId: c.dealId || undefined,
            leadId: c.leadId || undefined,
            disposition: c.disposition || undefined,
            notes: c.notes || undefined,
            summary: c.summary || undefined,
            queueName: c.queueName || undefined,
            assignedAgentId: c.assignedAgentId || undefined,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
            deletedAt: c.deletedAt?.toISOString() || undefined
        };
    }

    private mapPrismaParticipantToParticipant(p: any): CallParticipant {
        return {
            id: p.id,
            callId: p.callId,
            participantSid: p.participantSid || undefined,
            phoneNumber: p.phoneNumber,
            name: p.name || undefined,
            role: p.role as any,
            joinTime: p.joinTime?.toISOString(),
            leaveTime: p.leaveTime?.toISOString(),
            muted: p.muted,
            hold: p.hold,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString(),
            companyId: p.companyId
        };
    }

    private mapPrismaRecordingToRecording(r: any): CallRecording {
        return {
            id: r.id,
            callId: r.callId,
            recordingSid: r.recordingSid,
            recordingUrl: r.recordingUrl || undefined,
            localFilePath: r.localFilePath || undefined,
            duration: r.duration,
            fileSize: r.fileSize || undefined,
            channels: r.channels,
            status: r.status as any,
            transcriptionSid: r.transcriptionSid || undefined,
            transcriptionText: r.transcriptionText || undefined,
            transcriptionStatus: r.transcriptionStatus as any,
            transcriptionUrl: r.transcriptionUrl || undefined,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            companyId: r.companyId
        };
    }

    private mapPrismaEventToEvent(e: any): CallEvent {
        return {
            id: e.id,
            callId: e.callId,
            eventType: e.eventType,
            eventData: e.eventData || undefined,
            triggeredBy: e.triggeredBy || undefined,
            createdAt: e.createdAt.toISOString(),
            updatedAt: e.updatedAt.toISOString(),
            companyId: e.companyId
        };
    }
}
