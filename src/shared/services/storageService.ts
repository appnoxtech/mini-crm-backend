import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";

export interface ProcessedFile {
    originalName: string;
    url: string;
    mimetype: string;
    size: number;
    key: string;
}

export class StorageService {
    private s3Client: S3Client;
    private bucketName: string;

    constructor() {
        this.s3Client = new S3Client({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.ACCESS_KEY || '',
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.ACCESS_SECRET_KEY || '',
            },
        });
        this.bucketName = process.env.AWS_S3_BUCKET || 'mini-crm-uploads';
    }

    /**
     * Process and upload a file to S3
     */
    async processAndUpload(
        tempFilePath: string,
        originalName: string,
        mimetype: string
    ): Promise<ProcessedFile> {
        let fileBuffer: Buffer = await fs.readFile(tempFilePath);
        let contentType = mimetype;
        const fileExt = path.extname(originalName).toLowerCase();
        const fileName = `${uuidv4()}${fileExt}`;
        const key = `uploads/${fileName}`;

        // Process Images
        if (contentType.startsWith('image/')) {
            try {
                fileBuffer = await sharp(fileBuffer)
                    .jpeg({ quality: 60, progressive: true })
                    .toBuffer();
                contentType = 'image/jpeg';
            } catch (error) {
                console.warn(`Compression failed for ${originalName}, using original.`, error);
            }
        }
        // Process PDFs
        else if (contentType === 'application/pdf') {
            try {
                const pdfDoc = await PDFDocument.load(fileBuffer);
                const compressedPdf = await pdfDoc.save({ useObjectStreams: true });
                fileBuffer = Buffer.from(compressedPdf);
            } catch (error) {
                console.warn(`PDF compression failed for ${originalName}, using original.`, error);
            }
        }

        // Upload to S3 with no-cache headers
        await this.s3Client.send(new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: fileBuffer,
            ContentType: contentType,
            CacheControl: 'no-cache, no-store, must-revalidate',
            Expires: new Date(0)
        }));

        const region = process.env.AWS_REGION || 'us-east-1';
        const url = `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;

        return {
            originalName,
            url,
            mimetype: contentType,
            size: fileBuffer.length,
            key
        };
    }

    /**
     * Delete temporary files
     */
    async cleanup(filePaths: string[]): Promise<void> {
        await Promise.all(
            filePaths.map(path => fs.unlink(path).catch(err => console.error(`Cleanup error: ${path}`, err)))
        );
    }

    /**
     * Delete files from S3 with verification
     */
    async deleteFromS3(keys: string[]): Promise<void> {
        if (!keys || keys.length === 0) {
            console.log('No keys to delete');
            return;
        }

        console.log('🗑️  Attempting to delete from S3:', keys);

        try {
            const command = new DeleteObjectsCommand({
                Bucket: this.bucketName,
                Delete: {
                    Objects: keys.map(key => ({ Key: key })),
                    Quiet: false // Important: get detailed response
                }
            });

            const result = await this.s3Client.send(command);

            // Log successful deletions
            if (result.Deleted && result.Deleted.length > 0) {
                console.log('✅ Successfully deleted:', result.Deleted.map(d => d.Key));
            }

            // Log any errors
            if (result.Errors && result.Errors.length > 0) {
                console.error('❌ Deletion errors:', result.Errors);
                throw new Error(`Failed to delete some objects: ${JSON.stringify(result.Errors)}`);
            }

            // Verify deletion (optional but recommended for debugging)
            if (process.env.NODE_ENV === 'development') {
                await this.verifyDeletion(keys);
            }

        } catch (error) {
            console.error("❌ S3 delete failed:", error);
            throw error;
        }
    }

    /**
     * Verify files are actually deleted from S3
     */
    private async verifyDeletion(keys: string[]): Promise<void> {
        console.log('🔍 Verifying deletion...');

        for (const key of keys) {
            try {
                await this.s3Client.send(new HeadObjectCommand({
                    Bucket: this.bucketName,
                    Key: key
                }));
                console.warn(`⚠️  WARNING: File still exists in S3: ${key}`);
            } catch (error: any) {
                if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
                    console.log(`✅ Confirmed deleted: ${key}`);
                } else {
                    console.error(`❓ Error verifying ${key}:`, error.message);
                }
            }
        }
    }
}

// Export a singleton
export const storageService = new StorageService();

/**
 * Safely delete files from S3 with retry mechanism
 */
export async function safeDeleteFromS3(keys: string[], retries = 3): Promise<void> {
    if (!keys || keys.length === 0) {
        console.log('safeDeleteFromS3: No keys provided');
        return;
    }

    console.log(`🔄 safeDeleteFromS3 called with ${keys.length} keys, ${retries} retries remaining`);

    try {
        await storageService.deleteFromS3(keys);
        console.log('✅ safeDeleteFromS3: Deletion successful');
    } catch (err: any) {
        console.error(`❌ safeDeleteFromS3: Attempt failed. Retries left: ${retries - 1}`, err.message);

        if (retries > 0) {
            console.log(`⏳ Waiting 1 second before retry...`);
            await new Promise(r => setTimeout(r, 1000));
            return safeDeleteFromS3(keys, retries - 1);
        }

        console.error('❌ safeDeleteFromS3: All retries exhausted');
        throw err;
    }
}