import { prisma } from '../../../shared/prisma';
import { BaseEntity } from '../../../shared/types';
import { Prisma } from '@prisma/client';

export interface Lead extends BaseEntity {
  id: number;
  companyId: number;
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
  companyId: number;
  type: string;
  text: string;
  at: string;
}

export class LeadModel {
  constructor() { }

  initialize(): void { }

  async createLead(leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lead> {
    const lead = await prisma.lead.create({
      data: {
        name: leadData.name,
        company: leadData.company || null,
        value: leadData.value || null,
        notes: leadData.notes || null,
        stage: 'OPEN',
        userId: leadData.userId,
        companyId: leadData.companyId
      }
    });

    // Add initial history entry
    await this.addHistory(lead.id, lead.companyId, 'status', 'Stage → Open');

    return this.mapPrismaLeadToLead(lead);
  }

  async findById(id: number, companyId: number): Promise<Lead | null> {
    const lead = await prisma.lead.findFirst({
      where: { id, companyId }
    });
    return lead ? this.mapPrismaLeadToLead(lead) : null;
  }

  async findByUserId(userId: number, companyId: number, options: {
    stage?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ leads: Lead[]; count: number }> {
    const where: any = { userId, companyId };

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

  async updateStage(id: number, userId: number, companyId: number, stage: 'OPEN' | 'WON' | 'LOST'): Promise<Lead | null> {
    const now = new Date();
    const closedAt = stage === 'WON' ? now : null;

    try {
      const updateResult = await prisma.lead.updateMany({
        where: { id, userId, companyId },
        data: {
          stage,
          closedAt,
          updatedAt: now
        }
      });

      if (updateResult.count === 0) return null;

      const lead = await this.findById(id, companyId);

      // Add history entry
      await this.addHistory(id, companyId, 'status', `Stage → ${stage}`);

      return this.mapPrismaLeadToLead(lead);
    } catch (error) {
      return null;
    }
  }

  async addHistory(leadId: number, companyId: number, type: string, text: string): Promise<void> {
    await prisma.leadHistory.create({
      data: {
        leadId,
        companyId,
        type,
        text,
        at: new Date()
      }
    });
  }

  async getHistory(leadId: number, companyId: number): Promise<LeadHistory[]> {
    const rows = await prisma.leadHistory.findMany({
      where: { leadId, companyId },
      orderBy: { at: 'desc' }
    });

    return rows.map((row: any) => ({
      id: row.id,
      leadId: row.leadId,
      companyId: row.companyId,
      type: row.type,
      text: row.text,
      at: row.at.toISOString()
    }));
  }

  async deleteLead(id: number, userId: number, companyId: number): Promise<boolean> {
    try {
      const deleteResult = await prisma.lead.deleteMany({
        where: { id, userId, companyId }
      });
      return deleteResult.count > 0;
    } catch (error) {
      return false;
    }
  }

  async getStats(userId: number, companyId: number): Promise<{
    total: number;
    openCount: number;
    wonCount: number;
    lostCount: number;
    totalValue: number;
    wonValue: number;
  }> {
    const stats = await prisma.lead.groupBy({
      by: ['stage'],
      where: { userId, companyId },
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
      companyId: lead.companyId,
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
