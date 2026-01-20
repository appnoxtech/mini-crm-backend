export interface ProcessedFile {
    originalName: string;
    url: string;
    mimetype: string;
    size: number;
    key: string;
}
export declare class StorageService {
    private s3Client;
    private bucketName;
    constructor();
    /**
     * Process and upload a file to S3
     */
    processAndUpload(tempFilePath: string, originalName: string, mimetype: string): Promise<ProcessedFile>;
    /**
     * Delete temporary files
     */
    cleanup(filePaths: string[]): Promise<void>;
    /**
     * Delete files from S3 with verification
     */
    deleteFromS3(keys: string[]): Promise<void>;
    /**
     * Verify files are actually deleted from S3
     */
    private verifyDeletion;
}
export declare const storageService: StorageService;
/**
 * Safely delete files from S3 with retry mechanism
 */
export declare function safeDeleteFromS3(keys: string[], retries?: number): Promise<void>;
//# sourceMappingURL=storageService.d.ts.map