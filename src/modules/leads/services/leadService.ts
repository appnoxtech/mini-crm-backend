import { Lead, LeadHistory } from '../models/Lead';
import { AuthenticatedRequest } from '../../../shared/types';

export class LeadService {
  constructor(private leadModel: any) {}

  async createLead(userId: number, leadData: {
    name: string;
    company?: string;
    value?: number;
    notes?: string;
  }): Promise<Lead> {
    if (!leadData.name || !leadData.name.trim()) {
      throw new Error('Name is required');
    }

    return this.leadModel.createLead({
      ...leadData,
      name: leadData.name.trim(),
      company: leadData.company?.trim(),
      userId
    });
  }

  async getLeads(userId: number, options: {
    stage?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ leads: Lead[]; count: number }> {
    return this.leadModel.findByUserId(userId, options);
  }

  async getLeadById(id: number, userId: number): Promise<Lead | null> {
    const lead = this.leadModel.findById(id);
    if (!lead || lead.userId !== userId) {
      return null;
    }
    return lead;
  }

  async updateLeadStage(id: number, userId: number, stage: 'OPEN' | 'WON' | 'LOST'): Promise<Lead | null> {
    if (!['OPEN', 'WON', 'LOST'].includes(stage)) {
      throw new Error('Invalid stage');
    }

    return this.leadModel.updateStage(id, userId, stage);
  }

  async addActivity(id: number, userId: number, type: string, text: string): Promise<void> {
    const lead = this.leadModel.findById(id);
    if (!lead || lead.userId !== userId) {
      throw new Error('Lead not found');
    }

    if (!type || !text || !text.trim()) {
      throw new Error('Type and text are required');
    }

    this.leadModel.addHistory(id, type, text.trim());
  }

  async getLeadHistory(id: number, userId: number): Promise<LeadHistory[]> {
    const lead = this.leadModel.findById(id);
    if (!lead || lead.userId !== userId) {
      throw new Error('Lead not found');
    }

    return this.leadModel.getHistory(id);
  }

  async deleteLead(id: number, userId: number): Promise<boolean> {
    return this.leadModel.deleteLead(id, userId);
  }

  async getStats(userId: number): Promise<{
    total: number;
    openCount: number;
    wonCount: number;
    lostCount: number;
    totalValue: number;
    wonValue: number;
  }> {
    return this.leadModel.getStats(userId);
  }
}
