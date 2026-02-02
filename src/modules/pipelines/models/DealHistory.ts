import { prisma } from '../../../shared/prisma';
import { Prisma } from '@prisma/client';

export interface DealHistory {
  id: number;
  dealId: number;
  userId: number;
  eventType: string;
  fromValue?: string;
  toValue?: string;
  fromStageId?: number;
  toStageId?: number;
  stageDuration?: number;
  description?: string;
  metadata?: any;
  createdAt: string;
  leftAt?: string;
}

export class DealHistoryModel {
  constructor(_db?: any) { }

  initialize(): void {
    // No-op with Prisma
  }

  async create(data: Omit<DealHistory, 'id'>): Promise<DealHistory> {
    const history = await prisma.dealHistory.create({
      data: {
        dealId: data.dealId,
        userId: data.userId,
        eventType: data.eventType,
        fromValue: data.fromValue || null,
        toValue: data.toValue || null,
        fromStageId: data.fromStageId || null,
        toStageId: data.toStageId || null,
        stageDuration: data.stageDuration || null,
        description: data.description || null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
        leftAt: data.leftAt ? new Date(data.leftAt) : null
      }
    });

    return this.mapPrismaHistoryToHistory(history);
  }

  async findById(id: number): Promise<DealHistory | null> {
    const history = await prisma.dealHistory.findUnique({
      where: { id }
    });
    return history ? this.mapPrismaHistoryToHistory(history) : null;
  }

  async findByDealId(dealId: number, limit?: number): Promise<DealHistory[]> {
    const rows = await prisma.dealHistory.findMany({
      where: { dealId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return rows.map((r: any) => this.mapPrismaHistoryToHistory(r));
  }

  async findLastStageChange(dealId: number): Promise<DealHistory | null> {
    const history = await prisma.dealHistory.findFirst({
      where: { dealId, eventType: 'stage_change' },
      orderBy: { createdAt: 'desc' }
    });
    return history ? this.mapPrismaHistoryToHistory(history) : null;
  }

  async findByEventType(dealId: number, eventType: string): Promise<DealHistory[]> {
    const rows = await prisma.dealHistory.findMany({
      where: { dealId, eventType },
      orderBy: { createdAt: 'desc' }
    });
    return rows.map((r: any) => this.mapPrismaHistoryToHistory(r));
  }

  async closeOpenStageRecord(dealId: number, closedAt?: string): Promise<void> {
    const now = closedAt ? new Date(closedAt) : new Date();
    const openRecords = await prisma.dealHistory.findMany({
      where: { dealId, eventType: 'stage_change', leftAt: null }
    });

    for (const record of openRecords) {
      const created = record.createdAt;
      const durationInDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);

      await prisma.dealHistory.update({
        where: { id: record.id },
        data: {
          leftAt: now,
          stageDuration: durationInDays
        }
      });
    }
  }

  async getStageDurations(dealId: number): Promise<Array<{ stageId: number; stageName: string; totalDuration: number }>> {
    const records = await prisma.dealHistory.findMany({
      where: { dealId, eventType: 'stage_change' },
      include: {
        toStage: true
      }
    });

    const stageMap = new Map<number, { name: string; total: number }>();
    const now = new Date();

    for (const record of records) {
      if (!record.toStageId) continue;

      let duration = record.stageDuration || 0;

      if (!record.leftAt) {
        const created = record.createdAt;
        duration += (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      }

      const stageId = record.toStageId;
      const stageName = record.toStage?.name || 'Unknown';
      const existing = stageMap.get(stageId) || { name: stageName, total: 0 };
      existing.total += duration;
      stageMap.set(stageId, existing);
    }

    return Array.from(stageMap.entries()).map(([id, data]) => ({
      stageId: id,
      stageName: data.name,
      totalDuration: Math.round(data.total * 100) / 100
    }));
  }

  async getTimeInStages(dealId: number): Promise<Array<{ stageId: number; stageName: string; duration: number }>> {
    const records = await prisma.dealHistory.findMany({
      where: { dealId, eventType: 'stage_change', stageDuration: { not: null } },
      include: { toStage: true },
      orderBy: { createdAt: 'asc' }
    });

    return records.map((r: any) => ({
      stageId: r.toStageId!,
      stageName: r.toStage?.name || 'Unknown',
      duration: r.stageDuration || 0
    }));
  }

  async delete(id: number): Promise<boolean> {
    try {
      await prisma.dealHistory.delete({
        where: { id }
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  private mapPrismaHistoryToHistory(h: any): DealHistory {
    const history: DealHistory = {
      id: h.id,
      dealId: h.dealId,
      userId: h.userId,
      eventType: h.eventType,
      fromValue: h.fromValue || undefined,
      toValue: h.toValue || undefined,
      fromStageId: h.fromStageId || undefined,
      toStageId: h.toStageId || undefined,
      stageDuration: h.stageDuration || undefined,
      description: h.description || undefined,
      metadata: h.metadata ? JSON.parse(h.metadata as string) : undefined,
      createdAt: h.createdAt.toISOString(),
      leftAt: h.leftAt?.toISOString() || undefined
    };

    if (history.eventType === 'stage_change' && !history.leftAt && history.createdAt) {
      const created = new Date(history.createdAt);
      const now = new Date();
      history.stageDuration = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    }

    return history;
  }
}
