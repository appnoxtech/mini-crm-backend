import { Response } from 'express';
import { ImportService } from '../services/importService';
import { AuthenticatedRequest } from '../../../shared/types';
export declare class ImportController {
    private importService;
    constructor(importService: ImportService);
    /**
     * Upload file and get preview
     * POST /api/import/upload
     */
    uploadFile: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Validate mapping
     * POST /api/import/:id/validate
     */
    validateMapping: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Start import
     * POST /api/import/:id/start
     */
    startImport: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Get import status
     * GET /api/import/:id/status
     */
    getImportStatus: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Get import errors
     * GET /api/import/:id/errors
     */
    getImportErrors: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Get import history
     * GET /api/import/history
     */
    getImportHistory: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Cancel/delete import
     * DELETE /api/import/:id
     */
    cancelImport: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Get field definitions for entity type
     * GET /api/import/fields/:entityType
     */
    getFieldDefinitions: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Download sample CSV
     * GET /api/import/sample/:entityType
     */
    downloadSampleCSV: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Save mapping template
     * POST /api/import/templates
     */
    saveTemplate: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Get user's templates
     * GET /api/import/templates
     */
    getTemplates: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
    /**
     * Delete template
     * DELETE /api/import/templates/:id
     */
    deleteTemplate: (req: AuthenticatedRequest, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
}
//# sourceMappingURL=importController.d.ts.map