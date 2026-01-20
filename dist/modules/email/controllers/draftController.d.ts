import { Request, Response } from 'express';
import { DraftService } from '../services/draftService';
/**
 * Draft Controller - HTTP request/response handling for draft operations
 * Following first principles: Separate concerns (validation, business logic, HTTP)
 */
export declare class DraftController {
    private draftService;
    constructor(draftService: DraftService);
    /**
     * POST /api/email/drafts
     * Create a new draft
     */
    createDraft: (req: Request, res: Response) => Promise<void>;
    /**
     * GET /api/email/drafts/:draftId
     * Get a specific draft by ID
     */
    getDraftById: (req: Request, res: Response) => Promise<void>;
    /**
     * GET /api/email/drafts
     * List drafts with filtering and pagination
     */
    listDrafts: (req: Request, res: Response) => Promise<void>;
    /**
     * PUT /api/email/drafts/:draftId
     * Update an existing draft
     */
    updateDraft: (req: Request, res: Response) => Promise<void>;
    /**
     * DELETE /api/email/drafts/:draftId
     * Delete a draft
     */
    deleteDraft: (req: Request, res: Response) => Promise<void>;
    /**
     * POST /api/email/drafts/:draftId/send
     * Send a draft
     */
    sendDraft: (req: Request, res: Response) => Promise<void>;
    /**
     * POST /api/email/drafts/:draftId/duplicate
     * Duplicate a draft
     */
    duplicateDraft: (req: Request, res: Response) => Promise<void>;
    /**
     * POST /api/email/drafts/scheduled/process
     * Process scheduled drafts (typically called by a cron job)
     */
    processScheduledDrafts: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=draftController.d.ts.map