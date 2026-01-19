import { Request, Response, NextFunction } from 'express';
import fileUpload from 'express-fileupload';
import os from 'os';
import { storageService, ProcessedFile } from '../services/storageService';
import { ResponseHandler } from '../responses/responses';

/**
 * Extend Express Request to include processed files
 */
declare global {
    namespace Express {
        interface Request {
            processedFiles?: ProcessedFile[];
        }
    }
}

/**
 * Configure express-fileupload middleware
 */
const uploader = fileUpload({
    useTempFiles: true,
    tempFileDir: os.tmpdir(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    abortOnLimit: true,
    createParentPath: true,
});

/**
 * Custom File Processing Middleware
 */
async function processUploadedFiles(req: Request, res: Response, next: NextFunction) {
    if (!req.files || Object.keys(req.files).length === 0) {
        return ResponseHandler.validationError(res, 'No files were uploaded.');
    }

    const tempFilesToCleanup: string[] = [];
    const processedFilesList: ProcessedFile[] = [];

    try {
        const files = req.files;
        const allFiles: fileUpload.UploadedFile[] = [];

        // Normalize files into a flat array
        for (const key of Object.keys(files)) {
            const fileOrArray = files[key];
            if (fileOrArray) {
                if (Array.isArray(fileOrArray)) {
                    allFiles.push(...fileOrArray);
                } else {
                    allFiles.push(fileOrArray);
                }
            }
        }

        // Process and upload each file
        for (const file of allFiles) {
            if (file.tempFilePath) {
                tempFilesToCleanup.push(file.tempFilePath);
            }

            const processed = await storageService.processAndUpload(
                file.tempFilePath,
                file.name,
                file.mimetype
            );

            processedFilesList.push(processed);
        }

        // Cleanup temp files
        await storageService.cleanup(tempFilesToCleanup);

        // Attach results to request
        req.processedFiles = processedFilesList;
        next();

    } catch (error: any) {
        // Cleanup temp files on error
        await storageService.cleanup(tempFilesToCleanup);

        console.error('[FileUploadMiddleware] Error:', error);
        return ResponseHandler.internalError(res, 'Failed to process and upload files', error.message);
    }
}

/**
 * Combined Middleware export
 * This matches the system standard by using ResponseHandler and separating concerns.
 */
export const fileUploadMiddleware = [uploader, processUploadedFiles];
