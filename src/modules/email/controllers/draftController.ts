import { Request, Response } from 'express';
import { DraftService } from '../services/draftService';
import { CreateDraftInput, UpdateDraftInput, ListDraftsOptions } from '../models/draftTypes';

/**
 * Draft Controller - HTTP request/response handling for draft operations
 * Following first principles: Separate concerns (validation, business logic, HTTP)
 */
export class DraftController {
    constructor(private draftService: DraftService) { }

    /**
     * POST /api/email/drafts
     * Create a new draft
     */
    createDraft = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req as any).user.id;
            console.log('DraftController.createDraft - UserID:', userId, 'Body:', JSON.stringify(req.body, null, 2));
            const input: CreateDraftInput = req.body;

            const draft = await this.draftService.createDraft(userId, input);

            res.status(201).json({
                success: true,
                data: draft,
                message: 'Draft created successfully',
            });
        } catch (error: any) {
            console.error('Error creating draft:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to create draft',
            });
        }
    };

    /**
     * GET /api/email/drafts/:draftId
     * Get a specific draft by ID
     */
    getDraftById = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req as any).user.id;
            const { draftId } = req.params;

            if (!draftId) {
                res.status(400).json({
                    success: false,
                    error: 'Draft ID is required',
                });
                return;
            }

            const draft = await this.draftService.getDraftById(draftId, userId);

            if (!draft) {
                res.status(404).json({
                    success: false,
                    error: 'Draft not found',
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: draft,
            });
        } catch (error: any) {
            console.error('Error getting draft:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get draft',
            });
        }
    };

    /**
     * GET /api/email/drafts
     * List drafts with filtering and pagination
     */
    listDrafts = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req as any).user.id;

            // Parse query parameters
            const options: ListDraftsOptions = {
                limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
                offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
                search: req.query.search as string,
                accountId: req.query.accountId as string,
                scheduledOnly: req.query.scheduledOnly === 'true',
            };

            const result = await this.draftService.listDrafts(userId, options);

            res.status(200).json({
                success: true,
                data: result.drafts,
                pagination: {
                    total: result.total,
                    limit: options.limit || 50,
                    offset: options.offset || 0,
                },
            });
        } catch (error: any) {
            console.error('Error listing drafts:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to list drafts',
            });
        }
    };

    /**
     * PUT /api/email/drafts/:draftId
     * Update an existing draft
     */
    updateDraft = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req as any).user.id;
            const { draftId } = req.params;
            const updates: UpdateDraftInput = req.body;

            if (!draftId) {
                res.status(400).json({
                    success: false,
                    error: 'Draft ID is required',
                });
                return;
            }

            const draft = await this.draftService.updateDraft(draftId, userId, updates);

            if (!draft) {
                res.status(404).json({
                    success: false,
                    error: 'Draft not found',
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: draft,
                message: 'Draft updated successfully',
            });
        } catch (error: any) {
            console.error('Error updating draft:', error);
            res.status(400).json({
                success: false,
                error: error.message || 'Failed to update draft',
            });
        }
    };

    /**
     * DELETE /api/email/drafts/:draftId
     * Delete a draft
     */
    deleteDraft = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req as any).user.id;
            const { draftId } = req.params;

            if (!draftId) {
                res.status(400).json({
                    success: false,
                    error: 'Draft ID is required',
                });
                return;
            }

            const deleted = await this.draftService.deleteDraft(draftId, userId);

            if (!deleted) {
                res.status(404).json({
                    success: false,
                    error: 'Draft not found',
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Draft deleted successfully',
            });
        } catch (error: any) {
            console.error('Error deleting draft:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to delete draft',
            });
        }
    };

    /**
     * POST /api/email/drafts/:draftId/trash
     * Trash a draft (soft delete)
     */
    trashDraft = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req as any).user.id;
            const { draftId } = req.params;

            if (!draftId) {
                res.status(400).json({
                    success: false,
                    error: 'Draft ID is required',
                });
                return;
            }

            const draft = await this.draftService.trashDraft(draftId, userId);

            if (!draft) {
                res.status(404).json({
                    success: false,
                    error: 'Draft not found',
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: draft,
                message: 'Draft moved to trash',
            });
        } catch (error: any) {
            console.error('Error trashing draft:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to trash draft',
            });
        }
    };

    /**
     * POST /api/email/drafts/trash/batch
     * Trash multiple drafts (batch operation)
     */
    trashDraftsBatch = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req as any).user.id;
            const { draftIds } = req.body;

            if (!Array.isArray(draftIds) || draftIds.length === 0) {
                res.status(400).json({
                    success: false,
                    error: 'Array of draft IDs is required',
                });
                return;
            }

            const result = await this.draftService.trashDraftsBatch(draftIds, userId);

            res.status(200).json({
                success: true,
                data: result,
                message: `Moved ${result.trashed} draft(s) to trash${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
            });
        } catch (error: any) {
            console.error('Error batch trashing drafts:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to trash drafts',
            });
        }
    };

    /**
     * POST /api/email/drafts/:draftId/restore
     * Restore a draft from trash
     */
    restoreDraftFromTrash = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req as any).user.id;
            const { draftId } = req.params;

            if (!draftId) {
                res.status(400).json({
                    success: false,
                    error: 'Draft ID is required',
                });
                return;
            }

            const draft = await this.draftService.restoreDraftFromTrash(draftId, userId);

            if (!draft) {
                res.status(404).json({
                    success: false,
                    error: 'Draft not found in trash',
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: draft,
                message: 'Draft restored from trash',
            });
        } catch (error: any) {
            console.error('Error restoring draft:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to restore draft',
            });
        }
    };

    /**
     * GET /api/email/drafts/trash/list
     * Get all trashed drafts
     */
    getTrashedDrafts = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req as any).user.id;
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
            const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

            const result = await this.draftService.getTrashedDrafts(userId, limit, offset);

            res.status(200).json({
                success: true,
                data: result.drafts,
                pagination: {
                    total: result.total,
                    limit,
                    offset,
                },
            });
        } catch (error: any) {
            console.error('Error getting trashed drafts:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get trashed drafts',
            });
        }
    };

    /**
     * DELETE /api/email/drafts/trash/:draftId
     * Permanently delete a trashed draft
     */
    deleteTrashedDraft = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req as any).user.id;
            const { draftId } = req.params;

            if (!draftId) {
                res.status(400).json({
                    success: false,
                    error: 'Draft ID is required',
                });
                return;
            }

            const deleted = await this.draftService.deleteTrashedDraft(draftId, userId);

            if (!deleted) {
                res.status(404).json({
                    success: false,
                    error: 'Trashed draft not found',
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Trashed draft permanently deleted',
            });
        } catch (error: any) {
            console.error('Error deleting trashed draft:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to delete trashed draft',
            });
        }
    };

    /**
     * DELETE /api/email/drafts/trash/empty
     * Permanently delete all trashed drafts
     */
    emptyTrash = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req as any).user.id;

            const result = await this.draftService.deleteAllTrashedDrafts(userId);

            res.status(200).json({
                success: true,
                data: result,
                message: `Permanently deleted ${result.deleted} trashed draft(s)`,
            });
        } catch (error: any) {
            console.error('Error emptying trash:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to empty trash',
            });
        }
    }

    /**
     * POST /api/email/drafts/:draftId/send
     * Send a draft
     */
    sendDraft = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req as any).user.id;
            const { draftId } = req.params;

            if (!draftId) {
                res.status(400).json({
                    success: false,
                    error: 'Draft ID is required',
                });
                return;
            }

            const result = await this.draftService.sendDraft(draftId, userId);

            if (!result.success) {
                res.status(400).json({
                    success: false,
                    error: result.error,
                });
                return;
            }

            res.status(200).json({
                success: true,
                data: { emailId: result.emailId },
                message: 'Draft sent successfully',
            });
        } catch (error: any) {
            console.error('Error sending draft:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to send draft',
            });
        }
    };

    /**
     * POST /api/email/drafts/:draftId/duplicate
     * Duplicate a draft
     */
    duplicateDraft = async (req: Request, res: Response): Promise<void> => {
        try {
            const userId = (req as any).user.id;
            const { draftId } = req.params;

            if (!draftId) {
                res.status(400).json({
                    success: false,
                    error: 'Draft ID is required',
                });
                return;
            }

            const draft = await this.draftService.duplicateDraft(draftId, userId);

            if (!draft) {
                res.status(404).json({
                    success: false,
                    error: 'Draft not found',
                });
                return;
            }

            res.status(201).json({
                success: true,
                data: draft,
                message: 'Draft duplicated successfully',
            });
        } catch (error: any) {
            console.error('Error duplicating draft:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to duplicate draft',
            });
        }
    };

    /**
     * POST /api/email/drafts/scheduled/process
     * Process scheduled drafts (typically called by a cron job)
     */
    processScheduledDrafts = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.draftService.processScheduledDrafts();

            res.status(200).json({
                success: true,
                data: result,
                message: `Processed ${result.processed} scheduled drafts ${result.errors > 0 ? `with ${result.errors} errors` : ''}`,
            });
        } catch (error: any) {
            console.error('Error processing scheduled drafts:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to process scheduled drafts',
            });
        }
    };
}
