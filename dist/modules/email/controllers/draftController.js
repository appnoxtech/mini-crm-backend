"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DraftController = void 0;
/**
 * Draft Controller - HTTP request/response handling for draft operations
 * Following first principles: Separate concerns (validation, business logic, HTTP)
 */
class DraftController {
    draftService;
    constructor(draftService) {
        this.draftService = draftService;
    }
    /**
     * POST /api/email/drafts
     * Create a new draft
     */
    createDraft = async (req, res) => {
        try {
            const userId = req.user.id;
            const input = req.body;
            const draft = await this.draftService.createDraft(userId, input);
            res.status(201).json({
                success: true,
                data: draft,
                message: 'Draft created successfully',
            });
        }
        catch (error) {
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
    getDraftById = async (req, res) => {
        try {
            const userId = req.user.id;
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
        }
        catch (error) {
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
    listDrafts = async (req, res) => {
        try {
            const userId = req.user.id;
            // Parse query parameters
            const options = {
                limit: req.query.limit ? parseInt(req.query.limit) : undefined,
                offset: req.query.offset ? parseInt(req.query.offset) : undefined,
                search: req.query.search,
                accountId: req.query.accountId,
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
        }
        catch (error) {
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
    updateDraft = async (req, res) => {
        try {
            const userId = req.user.id;
            const { draftId } = req.params;
            const updates = req.body;
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
        }
        catch (error) {
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
    deleteDraft = async (req, res) => {
        try {
            const userId = req.user.id;
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
        }
        catch (error) {
            console.error('Error deleting draft:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to delete draft',
            });
        }
    };
    /**
     * POST /api/email/drafts/:draftId/send
     * Send a draft
     */
    sendDraft = async (req, res) => {
        try {
            const userId = req.user.id;
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
        }
        catch (error) {
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
    duplicateDraft = async (req, res) => {
        try {
            const userId = req.user.id;
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
        }
        catch (error) {
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
    processScheduledDrafts = async (req, res) => {
        try {
            const result = await this.draftService.processScheduledDrafts();
            res.status(200).json({
                success: true,
                data: result,
                message: `Processed ${result.processed} scheduled drafts ${result.errors > 0 ? `with ${result.errors} errors` : ''}`,
            });
        }
        catch (error) {
            console.error('Error processing scheduled drafts:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to process scheduled drafts',
            });
        }
    };
}
exports.DraftController = DraftController;
//# sourceMappingURL=draftController.js.map