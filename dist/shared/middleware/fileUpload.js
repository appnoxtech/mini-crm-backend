"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileUploadMiddleware = void 0;
exports.safeDeleteFromS3 = safeDeleteFromS3;
const express_fileupload_1 = __importDefault(require("express-fileupload"));
const os_1 = __importDefault(require("os"));
const storageService_1 = require("../services/storageService");
const responses_1 = require("../responses/responses");
/**
 * Configure express-fileupload middleware
 */
const uploader = (0, express_fileupload_1.default)({
    useTempFiles: true,
    tempFileDir: os_1.default.tmpdir(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    abortOnLimit: true,
    createParentPath: true,
});
/**
 * Custom File Processing Middleware
 */
async function processUploadedFiles(req, res, next) {
    if (!req.files || Object.keys(req.files).length === 0) {
        return next();
    }
    const tempFilesToCleanup = [];
    const processedFilesList = [];
    try {
        const files = req.files;
        const allFiles = [];
        // Normalize files into a flat array
        for (const key of Object.keys(files)) {
            const fileOrArray = files[key];
            if (fileOrArray) {
                if (Array.isArray(fileOrArray)) {
                    allFiles.push(...fileOrArray);
                }
                else {
                    allFiles.push(fileOrArray);
                }
            }
        }
        // Process and upload each file
        for (const file of allFiles) {
            if (file.tempFilePath) {
                tempFilesToCleanup.push(file.tempFilePath);
            }
            const processed = await storageService_1.storageService.processAndUpload(file.tempFilePath, file.name, file.mimetype);
            processedFilesList.push(processed);
        }
        // Cleanup temp files
        await storageService_1.storageService.cleanup(tempFilesToCleanup);
        // Attach results to request
        req.processedFiles = processedFilesList;
        next();
    }
    catch (error) {
        // Cleanup temp files on error
        await storageService_1.storageService.cleanup(tempFilesToCleanup);
        console.error('[FileUploadMiddleware] Error:', error);
        return responses_1.ResponseHandler.internalError(res, 'Failed to process and upload files', error.message);
    }
}
async function safeDeleteFromS3(keys, retries = 3) {
    try {
        await storageService_1.storageService.deleteFromS3(keys);
    }
    catch (err) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, 1000));
            return safeDeleteFromS3(keys, retries - 1);
        }
        throw err;
    }
}
/**
 * Combined Middleware export
 * This matches the system standard by using ResponseHandler and separating concerns.
 */
exports.fileUploadMiddleware = [uploader, processUploadedFiles];
//# sourceMappingURL=fileUpload.js.map