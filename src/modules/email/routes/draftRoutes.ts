import { Router } from 'express';
import { DraftController } from '../controllers/draftController';
import { authMiddleware } from '../../../shared/middleware/auth';

/**
 * Draft Routes - RESTful API endpoints for draft operations
 * Following first principles: REST conventions, proper HTTP methods
 */
export function createDraftRoutes(draftController: DraftController): Router {
    const router = Router();

    // All draft routes require authentication
    (router as any).use(authMiddleware);

    // Draft CRUD operations
    router.post('/', (req: any, res) => draftController.createDraft(req, res));
    router.get('/', (req: any, res) => draftController.listDrafts(req, res));
    router.get('/:draftId', (req: any, res) => draftController.getDraftById(req, res));
    router.put('/:draftId', (req: any, res) => draftController.updateDraft(req, res));
    router.delete('/:draftId', (req: any, res) => draftController.deleteDraft(req, res));

    // Draft actions
    router.post('/:draftId/send', (req: any, res) => draftController.sendDraft(req, res));
    router.post('/:draftId/duplicate', (req: any, res) => draftController.duplicateDraft(req, res));

    // Scheduled drafts (typically for cron jobs or admin)
    router.post('/scheduled/process', (req: any, res) => draftController.processScheduledDrafts(req, res));

    return router;
}
