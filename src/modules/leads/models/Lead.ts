import { prisma } from '../../../shared/prisma';
import { BaseEntity } from '../../../shared/types';
import { Prisma } from '@prisma/client';

export interface Lead extends BaseEntity {
  name: string;
  company?: string;
  value?: number;
  stage: 'OPEN' | 'WON' | 'LOST';
  notes?: string;
  userId: number;
  closedAt?: string;
}

export interface LeadHistory {
  id: number;
  leadId: number;
  type: string;
  text: string;
  at: string;
}

export class LeadModel {
  constructor(_db?: any) { }

  initialize(): void {
    // No-op with Prisma
  }

  async createLead(leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead> {
    const lead = await prisma.lead.create({
      data: {
        name: leadData.name,
        company: leadData.company || null,
        value: leadData.value || null,
        notes: leadData.notes || null,
        stage: 'OPEN',
        userId: leadData.userId
      }
    });

    // Add initial history entry
    await this.addHistory(lead.id, 'status', 'Stage → Open');

    return this.mapPrismaLeadToLead(lead);
  }

  async findById(id: number): Promise<Lead | null> {
    const lead = await prisma.lead.findUnique({
      where: { id }
    });
    return lead ? this.mapPrismaLeadToLead(lead) : null;
  }

  async findByUserId(userId: number, options: {
    stage?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ leads: Lead[]; count: number }> {
    const where: any = { userId };

    if (options.stage && options.stage !== 'All') {
      where.stage = options.stage;
    }

    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { company: { contains: options.search, mode: 'insensitive' } },
        { notes: { contains: options.search, mode: 'insensitive' } }
      ];
    }

    const [leads, count] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit,
        skip: options.offset || 0
      }),
      prisma.lead.count({ where })
    ]);

    return {
      leads: leads.map((l: any) => this.mapPrismaLeadToLead(l)),
      count
    };
  }

  async updateStage(id: number, userId: number, stage: 'OPEN' | 'WON' | 'LOST'): Promise<Lead | null> {
    const now = new Date();
    const closedAt = stage === 'WON' ? now : null;

    try {
      const lead = await prisma.lead.update({
        where: { id, userId },
        data: {
          stage,
          closedAt,
          updatedAt: now
        }
      });

      // Add history entry
      await this.addHistory(id, 'status', `Stage → ${stage}`);

      return this.mapPrismaLeadToLead(lead);
    } catch (error) {
      return null;
    }
  }

  async addHistory(leadId: number, type: string, text: string): Promise<void> {
    await prisma.leadHistory.create({
      data: {
        leadId,
        type,
        text,
        at: new Date()
      }
    });
  }

  async getHistory(leadId: number): Promise<LeadHistory[]> {
    const rows = await prisma.leadHistory.findMany({
      where: { leadId },
      orderBy: { at: 'desc' }
    });

    return rows.map((row: any) => ({
      id: row.id,
      leadId: row.leadId,
      type: row.type,
      text: row.text,
      at: row.at.toISOString()
    }));
  }

  async deleteLead(id: number, userId: number): Promise<boolean> {
    try {
      await prisma.lead.delete({
        where: { id, userId }
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getStats(userId: number): Promise<{
    total: number;
    openCount: number;
    wonCount: number;
    lostCount: number;
    totalValue: number;
    wonValue: number;
  }> {
    const stats = await prisma.lead.groupBy({
      by: ['stage'],
      where: { userId },
      _count: { _all: true },
      _sum: { value: true }
    });

    const result = {
      total: 0,
      openCount: 0,
      wonCount: 0,
      lostCount: 0,
      totalValue: 0,
      wonValue: 0
    };

    stats.forEach((s: any) => {
      const count = s._count._all;
      const sum = s._sum.value || 0;
      result.total += count;
      result.totalValue += sum;
      if (s.stage === 'OPEN') result.openCount = count;
      if (s.stage === 'WON') {
        result.wonCount = count;
        result.wonValue = sum;
      }
      if (s.stage === 'LOST') result.lostCount = count;
    });

    return result;
  }

  private mapPrismaLeadToLead(lead: any): Lead {
    return {
      id: lead.id,
      name: lead.name,
      company: lead.company || undefined,
      value: lead.value || undefined,
      stage: lead.stage as any,
      notes: lead.notes || undefined,
      userId: lead.userId,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
      closedAt: lead.closedAt?.toISOString() || undefined
    };
  }
}
