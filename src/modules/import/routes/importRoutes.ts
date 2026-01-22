import { Router } from 'express';
import multer from 'multer';
import { ImportController } from '../controllers/importController';
import { authMiddleware } from '../../../shared/middleware/auth';

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'text/csv',
            'text/plain',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/json',
        ];

        if (allowedMimes.includes(file.mimetype) ||
            file.originalname.endsWith('.csv') ||
            file.originalname.endsWith('.xlsx') ||
            file.originalname.endsWith('.json')) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed types: CSV, XLSX, JSON'));
        }
    },
});

export function createImportRoutes(controller: ImportController): Router {
    const router = Router();

    // All routes require authentication
    router.use(authMiddleware);

    // Upload file and get preview
    router.post('/upload', upload.single('file'), controller.uploadFile);

    // Get field definitions for entity type
    router.get('/fields/:entityType', controller.getFieldDefinitions);

    // Download sample CSV
    router.get('/sample/:entityType', controller.downloadSampleCSV);

    // Get import history
    router.get('/history', controller.getImportHistory);

    // Template routes
    router.get('/templates', controller.getTemplates);
    router.post('/templates', controller.saveTemplate);
    router.delete('/templates/:id', controller.deleteTemplate);

    // Import job routes
    router.get('/:id/status', controller.getImportStatus);
    router.get('/:id/errors', controller.getImportErrors);
    router.post('/:id/validate', controller.validateMapping);
    router.post('/:id/start', controller.startImport);
    router.post('/:id/rollback', controller.rollbackImport);
    router.post('/:id/merge', controller.mergeImport);
    router.delete('/:id', controller.cancelImport);

    return router;
}
