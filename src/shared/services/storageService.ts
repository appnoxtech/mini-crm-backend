import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

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

        // Upload to S3
        await this.s3Client.send(new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: fileBuffer,
            ContentType: contentType,
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
}

// Export a singleton for easier use in functional middleware if needed, 
// or it can be instantiated in server.ts
export const storageService = new StorageService();
