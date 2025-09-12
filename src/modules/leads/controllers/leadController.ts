import { Request, Response } from 'express';
import { LeadService } from '../services/leadService';
import { AuthenticatedRequest } from '../../../shared/types';

export class LeadController {
  private leadService: LeadService;

  constructor(leadService: LeadService) {
    this.leadService = leadService;
  }

  async getLeads(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { stage, q, limit = 100, offset = 0 } = (req as any).query;
      
      const result = await this.leadService.getLeads(req.user.id, {
        stage: stage as string,
        search: q as string,
        limit: Number(limit),
        offset: Number(offset)
      });

      res.json({
        items: result.leads,
        count: result.count
      });
    } catch (error) {
      console.error('Error fetching leads:', error);
      res.status(500).json({ error: 'Failed to fetch leads' });
    }
  }

  async createLead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { name, company, value, notes } = req.body as any;

      const lead = await this.leadService.createLead(req.user.id, {
        name,
        company,
        value,
        notes
      });

      res.status(201).json(lead);
    } catch (error) {
      console.error('Error creating lead:', error);
      res.status(500).json({ error: 'Failed to create lead' });
    }
  }

  async updateLeadStage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { id } = (req as any).params;
      const { stage } = req.body as any;

      const lead = await this.leadService.updateLeadStage(Number(id), req.user.id, stage);
      
      if (!lead) {
        res.status(404).json({ error: 'Lead not found' });
        return;
      }

      res.json(lead);
    } catch (error) {
      console.error('Error updating lead stage:', error);
      res.status(500).json({ error: 'Failed to update lead stage' });
    }
  }

  async addActivity(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { id } = (req as any).params;
      const { type, text } = req.body as any;

      await this.leadService.addActivity(Number(id), req.user.id, type, text);

      res.json({ message: 'Activity added successfully' });
    } catch (error) {
      console.error('Error adding activity:', error);
      res.status(500).json({ error: 'Failed to add activity' });
    }
  }

  async getLeadHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { id } = (req as any).params;

      const history = await this.leadService.getLeadHistory(Number(id), req.user.id);

      res.json(history);
    } catch (error) {
      console.error('Error fetching lead history:', error);
      res.status(500).json({ error: 'Failed to fetch lead history' });
    }
  }

  async deleteLead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { id } = (req as any).params;

      const success = await this.leadService.deleteLead(Number(id), req.user.id);
      
      if (!success) {
        res.status(404).json({ error: 'Lead not found' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting lead:', error);
      res.status(500).json({ error: 'Failed to delete lead' });
    }
  }

  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const stats = await this.leadService.getStats(req.user.id);

      res.json(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  }
}
