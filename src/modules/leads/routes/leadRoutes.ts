import { Router } from 'express';
import { LeadController } from '../controllers/leadController';
import { authMiddleware } from '../../../shared/middleware/auth';
import validate from '../../../shared/validate';
import { addActivitySchema, createLeadSchema } from '../validations/leadSchema';

export function createLeadRoutes(leadController: LeadController): Router {
  const router = Router();

  // Apply auth middleware to all leads routes
  router.use(authMiddleware);

  // Lead CRUD operations
  router.get('/get',  (req: any, res) => leadController.getLeads(req, res));
  router.post('/create', validate(createLeadSchema), (req: any, res) => leadController.createLead(req, res));
  router.delete('/:id', (req: any, res) => leadController.deleteLead(req, res));

  // Lead stage management
  router.post('/:id/stage', (req: any, res) => leadController.updateLeadStage(req, res));

  // Lead activity
  router.post('/:id/activity', validate(addActivitySchema), (req: any, res) => leadController.addActivity(req, res));
  router.get('/:id/history', (req: any, res) => leadController.getLeadHistory(req, res));

  // Statistics
  router.get('/stats', (req: any, res) => leadController.getStats(req, res));

  return router;
}
