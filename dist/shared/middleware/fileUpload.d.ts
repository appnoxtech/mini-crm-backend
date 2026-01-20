import { ProcessedFile } from '../services/storageService';
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
export declare function safeDeleteFromS3(keys: string[], retries?: number): Promise<void>;
/**
 * Combined Middleware export
 * This matches the system standard by using ResponseHandler and separating concerns.
 */
export declare const fileUploadMiddleware: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>[];
//# sourceMappingURL=fileUpload.d.ts.map