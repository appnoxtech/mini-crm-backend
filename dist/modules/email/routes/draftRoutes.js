"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDraftRoutes = createDraftRoutes;
const express_1 = require("express");
const auth_1 = require("../../../shared/middleware/auth");
/**
 * Draft Routes - RESTful API endpoints for draft operations
 * Following first principles: REST conventions, proper HTTP methods
 */
function createDraftRoutes(draftController) {
    const router = (0, express_1.Router)();
    // All draft routes require authentication
    router.use(auth_1.authMiddleware);
    // Draft CRUD operations
    router.post('/', (req, res) => draftController.createDraft(req, res));
    router.get('/', (req, res) => draftController.listDrafts(req, res));
    router.get('/:draftId', (req, res) => draftController.getDraftById(req, res));
    router.put('/:draftId', (req, res) => draftController.updateDraft(req, res));
    router.delete('/:draftId', (req, res) => draftController.deleteDraft(req, res));
    // Draft actions
    router.post('/:draftId/send', (req, res) => draftController.sendDraft(req, res));
    router.post('/:draftId/duplicate', (req, res) => draftController.duplicateDraft(req, res));
    // Scheduled drafts (typically for cron jobs or admin)
    router.post('/scheduled/process', (req, res) => draftController.processScheduledDrafts(req, res));
    return router;
}
//# sourceMappingURL=draftRoutes.js.map