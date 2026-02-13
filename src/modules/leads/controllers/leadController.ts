import { Request, Response } from 'express';
import { LeadService } from '../services/leadService';
import { AuthenticatedRequest } from '../../../shared/types';
import { ResponseHandler } from '../../../shared/responses/responses';

export class LeadController {
  private leadService: LeadService;

  constructor(leadService: LeadService) {
    this.leadService = leadService;
  }

  async getLeads(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.companyId) {
        return ResponseHandler.validationError(res, 'User not authenticated or company missing');
      }

      const { stage, q, limit = 100, offset = 0 } = (req as any).query;

      const result = await this.leadService.getLeads(req.user.id, req.user.companyId, {
        stage: stage as string,
        search: q as string,
        limit: Number(limit),
        offset: Number(offset)
      });

      return ResponseHandler.success(res, result);


    } catch (error) {
      console.error('Error fetching leads:', error);
      return ResponseHandler.internalError(res, 'Failed to fetch leads');
    }
  }

  async createLead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.companyId) {
        return ResponseHandler.validationError(res, 'User not authenticated or company missing');
      }

      const { name, company, value, notes } = req.body as any;

      const lead = await this.leadService.createLead(req.user.id, req.user.companyId, {
        name,
        company,
        value,
        notes
      });

      return ResponseHandler.created(res, lead, "Lead Created Successfully!");

    } catch (error) {
      console.error('Error creating lead:', error);
      return ResponseHandler.internalError(res, 'Failed to create lead');
    }
  }

  async updateLeadStage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.companyId) {
        return ResponseHandler.validationError(res, 'User not authenticated or company missing');
      }

      const { id } = (req as any).params;
      const { stage } = req.body as any;

      const lead = await this.leadService.updateLeadStage(Number(id), req.user.id, req.user.companyId, stage);

      if (!lead) {
        res.status(404).json({ error: 'Lead not found' });
        return;
      }

      return ResponseHandler.success(res, lead, "Lead stage Update Successfully");

    } catch (error) {
      console.error('Error updating lead stage:', error);
      return ResponseHandler.internalError(res, 'Failed to update lead stage');
    }
  }

  async addActivity(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.companyId) {
        return ResponseHandler.validationError(res, 'User not authenticated or company missing');
      }

      const { id } = (req as any).params;
      const { type, text } = req.body as any;

      await this.leadService.addActivity(Number(id), req.user.id, req.user.companyId, type, text);

      return ResponseHandler.success(res, [], 'Activity added successfully');

    } catch (error) {
      console.error('Error adding activity:', error);
      return ResponseHandler.internalError(res, 'Failed to add activity');
    }
  }

  async getLeadHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.companyId) {
        return ResponseHandler.validationError(res, 'User not authenticated or company missing');
      }

      const { id } = (req as any).params;

      const history = await this.leadService.getLeadHistory(Number(id), req.user.id, req.user.companyId);

      return ResponseHandler.success(res, history, 'Successfully Fetched lead history');

    } catch (error) {
      console.error('Error fetching lead history:', error);
      return ResponseHandler.internalError(res, 'Failed to fetch lead history');
    }
  }

  async deleteLead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.companyId) {
        return ResponseHandler.validationError(res, 'User not authenticated or company missing');
      }

      const { id } = (req as any).params;

      const success = await this.leadService.deleteLead(Number(id), req.user.id, req.user.companyId);

      if (!success) {
        res.status(404).json({ error: 'Lead not found' });
        return;
      }
      return ResponseHandler.success(res, 'Lead is Deleted Successfully');

    } catch (error) {
      console.error('Error deleting lead:', error);
      return ResponseHandler.internalError(res, 'Failed to delete lead');
    }
  }

  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || !req.user.companyId) {
        return ResponseHandler.validationError(res, 'User not authenticated or company missing');
      }

      const stats = await this.leadService.getStats(req.user.id, req.user.companyId);

      return ResponseHandler.success(res, stats);

    } catch (error) {
      console.error('Error fetching stats:', error);
      return ResponseHandler.internalError(res, 'Failed to fetch stats');
    }
  }
}
