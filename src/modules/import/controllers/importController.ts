import { Request, Response } from 'express';
import { ImportService } from '../services/importService';
import { AuthenticatedRequest } from '../../../shared/types';
import { ImportEntityType, DuplicateHandling } from '../types';

export class ImportController {
    private importService: ImportService;

    constructor(importService: ImportService) {
        this.importService = importService;
    }

    /**
     * Upload file and get preview
     * POST /api/import/upload
     */
    uploadFile = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const file = req.file;
            if (!file) {
                return res.status(400).json({ success: false, error: 'No file uploaded' });
            }

            const { entityType } = req.body;
            if (!entityType || !['person', 'organization', 'deal', 'lead', 'note', 'activity'].includes(entityType)) {
                return res.status(400).json({ success: false, error: 'Invalid entity type' });
            }

            const preview = await this.importService.uploadFile(
                userId,
                {
                    originalname: file.originalname,
                    buffer: file.buffer,
                    mimetype: file.mimetype,
                },
                entityType as ImportEntityType
            );

            res.json({ success: true, data: preview });
        } catch (error: any) {
            console.error('Upload file error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    };

    /**
     * Validate mapping
     * POST /api/import/:id/validate
     */
    validateMapping = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const importId = parseInt(req.params.id);
            if (isNaN(importId)) {
                return res.status(400).json({ success: false, error: 'Invalid import ID' });
            }

            const { mapping } = req.body;
            if (!mapping || !Array.isArray(mapping)) {
                return res.status(400).json({ success: false, error: 'Mapping is required' });
            }

            const result = await this.importService.validateMapping(userId, importId, mapping);

            res.json({ success: true, data: result });
        } catch (error: any) {
            console.error('Validate mapping error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    };

    /**
     * Start import
     * POST /api/import/:id/start
     */
    startImport = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const importId = parseInt(req.params.id);
            if (isNaN(importId)) {
                return res.status(400).json({ success: false, error: 'Invalid import ID' });
            }

            const { duplicateHandling = 'skip' } = req.body;
            if (!['skip', 'update', 'create', 'error'].includes(duplicateHandling)) {
                return res.status(400).json({ success: false, error: 'Invalid duplicate handling option' });
            }

            const result = await this.importService.startImport(
                userId,
                importId,
                { duplicateHandling: duplicateHandling as DuplicateHandling }
            );

            res.json({ success: true, data: result });
        } catch (error: any) {
            console.error('Start import error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    };

    /**
     * Get import status
     * GET /api/import/:id/status
     */
    getImportStatus = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const importId = parseInt(req.params.id);
            if (isNaN(importId)) {
                return res.status(400).json({ success: false, error: 'Invalid import ID' });
            }

            const job = this.importService.getImportJob(userId, importId);
            if (!job) {
                return res.status(404).json({ success: false, error: 'Import job not found' });
            }

            res.json({ success: true, data: job });
        } catch (error: any) {
            console.error('Get import status error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    };

    /**
     * Get import errors
     * GET /api/import/:id/errors
     */
    getImportErrors = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const importId = parseInt(req.params.id);
            if (isNaN(importId)) {
                return res.status(400).json({ success: false, error: 'Invalid import ID' });
            }

            const limit = parseInt(req.query.limit as string) || 100;
            const errors = this.importService.getImportErrors(userId, importId, limit);

            res.json({ success: true, data: errors });
        } catch (error: any) {
            console.error('Get import errors error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    };

    /**
     * Get import history
     * GET /api/import/history
     */
    getImportHistory = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const limit = parseInt(req.query.limit as string) || 20;
            const offset = parseInt(req.query.offset as string) || 0;

            const history = this.importService.getImportHistory(userId, limit, offset);

            res.json({ success: true, data: history });
        } catch (error: any) {
            console.error('Get import history error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    };

    /**
     * Cancel/delete import
     * DELETE /api/import/:id
     */
    cancelImport = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const importId = parseInt(req.params.id);
            if (isNaN(importId)) {
                return res.status(400).json({ success: false, error: 'Invalid import ID' });
            }

            const deleted = this.importService.cancelImport(userId, importId);

            res.json({ success: true, data: { deleted } });
        } catch (error: any) {
            console.error('Cancel import error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    };

    /**
     * Rollback import
     * POST /api/import/:id/rollback
     */
    rollbackImport = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const importId = parseInt(req.params.id);
            if (isNaN(importId)) {
                return res.status(400).json({ success: false, error: 'Invalid import ID' });
            }

            const result = this.importService.rollbackImport(userId, importId);

            res.json({ success: true, data: result });
        } catch (error: any) {
            console.error('Rollback import error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    };

    /**
     * Merge staged import
     * POST /api/import/:id/merge
     */
    mergeImport = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const importId = parseInt(req.params.id);
            if (isNaN(importId)) {
                return res.status(400).json({ success: false, error: 'Invalid import ID' });
            }

            const result = await this.importService.mergeImport(userId, importId);

            res.json({ success: true, data: result });
        } catch (error: any) {
            console.error('Merge import error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    };

    /**
     * Get field definitions for entity type
     * GET /api/import/fields/:entityType
     */
    getFieldDefinitions = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const entityType = req.params.entityType as ImportEntityType;
            if (!['person', 'organization', 'deal', 'lead', 'note', 'activity'].includes(entityType)) {
                return res.status(400).json({ success: false, error: 'Invalid entity type' });
            }

            const fields = this.importService.getFieldDefinitions(entityType);

            res.json({ success: true, data: fields });
        } catch (error: any) {
            console.error('Get field definitions error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    };

    /**
     * Download sample CSV
     * GET /api/import/sample/:entityType
     */
    downloadSampleCSV = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const entityType = req.params.entityType as ImportEntityType;
            if (!['person', 'organization'].includes(entityType)) {
                return res.status(400).json({ success: false, error: 'Sample not available for this entity type' });
            }

            const csvContent = this.importService.generateSampleCSV(entityType);

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${entityType}_import_sample.csv`);
            res.send(csvContent);
        } catch (error: any) {
            console.error('Download sample CSV error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    };

    /**
     * Save mapping template
     * POST /api/import/templates
     */
    saveTemplate = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const { name, entityType, mapping } = req.body;
            if (!name || !entityType || !mapping) {
                return res.status(400).json({ success: false, error: 'Name, entityType, and mapping are required' });
            }

            const templateId = this.importService.saveTemplate(userId, name, entityType, mapping);

            res.json({ success: true, data: { id: templateId } });
        } catch (error: any) {
            console.error('Save template error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    };

    /**
     * Get user's templates
     * GET /api/import/templates
     */
    getTemplates = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const entityType = req.query.entityType as ImportEntityType | undefined;
            const templates = this.importService.getTemplates(userId, entityType);

            res.json({ success: true, data: templates });
        } catch (error: any) {
            console.error('Get templates error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    };

    /**
     * Delete template
     * DELETE /api/import/templates/:id
     */
    deleteTemplate = async (req: AuthenticatedRequest, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const templateId = parseInt(req.params.id);
            if (isNaN(templateId)) {
                return res.status(400).json({ success: false, error: 'Invalid template ID' });
            }

            const deleted = this.importService.deleteTemplate(userId, templateId);

            res.json({ success: true, data: { deleted } });
        } catch (error: any) {
            console.error('Delete template error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    };
}
