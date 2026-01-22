"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createImportRoutes = createImportRoutes;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../../../shared/middleware/auth");
// Configure multer for file uploads
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
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
        }
        else {
            cb(new Error('Invalid file type. Allowed types: CSV, XLSX, JSON'));
        }
    },
});
function createImportRoutes(controller) {
    const router = (0, express_1.Router)();
    // All routes require authentication
    router.use(auth_1.authMiddleware);
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
    router.delete('/:id', controller.cancelImport);
    return router;
}
//# sourceMappingURL=importRoutes.js.map