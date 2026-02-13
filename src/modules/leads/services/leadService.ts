import { Lead, LeadHistory } from '../models/Lead';
import { AuthenticatedRequest } from '../../../shared/types';

export class LeadService {
  constructor(private leadModel: any) { }

  async createLead(userId: number, companyId: number, leadData: {
    name: string;
    company?: string;
    value?: number;
    notes?: string;
  }): Promise<Lead> {
    if (!leadData.name || !leadData.name.trim()) {
      throw new Error('Name is required');
    }

    return await this.leadModel.createLead({
      ...leadData,
      name: leadData.name.trim(),
      company: leadData.company?.trim(),
      userId,
      companyId
    });
  }

  async getLeads(userId: number, companyId: number, options: {
    stage?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ leads: Lead[]; count: number }> {
    return await this.leadModel.findByUserId(userId, companyId, options);
  }

  async getLeadById(id: number, userId: number, companyId: number): Promise<Lead | null> {
    const lead = await this.leadModel.findById(id, companyId);
    if (!lead || lead.userId !== userId) {
      return null;
    }
    return lead;
  }

  async updateLeadStage(id: number, userId: number, companyId: number, stage: 'OPEN' | 'WON' | 'LOST'): Promise<Lead | null> {
    if (!['OPEN', 'WON', 'LOST'].includes(stage)) {
      throw new Error('Invalid stage');
    }

    return await this.leadModel.updateStage(id, userId, companyId, stage);
  }

  async addActivity(id: number, userId: number, companyId: number, type: string, text: string): Promise<void> {
    const lead = await this.leadModel.findById(id, companyId);
    if (!lead || lead.userId !== userId) {
      throw new Error('Lead not found');
    }

    if (!type || !text || !text.trim()) {
      throw new Error('Type and text are required');
    }

    await this.leadModel.addHistory(id, companyId, type, text.trim());
  }

  async getLeadHistory(id: number, userId: number, companyId: number): Promise<LeadHistory[]> {
    const lead = await this.leadModel.findById(id, companyId);
    if (!lead || lead.userId !== userId) {
      throw new Error('Lead not found');
    }

    return await this.leadModel.getHistory(id, companyId);
  }

  async deleteLead(id: number, userId: number, companyId: number): Promise<boolean> {
    return await this.leadModel.deleteLead(id, userId, companyId);
  }

  async getStats(userId: number, companyId: number): Promise<{
    total: number;
    openCount: number;
    wonCount: number;
    lostCount: number;
    totalValue: number;
    wonValue: number;
  }> {
    return await this.leadModel.getStats(userId, companyId);
  }
}
