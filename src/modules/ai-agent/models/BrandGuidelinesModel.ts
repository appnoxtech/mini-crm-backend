import { prisma } from '../../../shared/prisma';

export interface BrandGuidelines {
    tone: string;
    voiceCharacteristics: string[];
    openingPhrases: string[];
    closingPhrases: string[];
    signatureTemplate: string;
    ctaPatterns: string[];
    avoidPhrases: string[];
    updatedAt: string;
}

export class BrandGuidelinesModel {
    constructor(_db?: any) { }

    initialize(): void {
        // No-op with Prisma
    }

    async getGuidelines(): Promise<BrandGuidelines | null> {
        const row = await prisma.brandGuidelines.findFirst();
        if (!row) return null;

        return {
            tone: row.tone,
            voiceCharacteristics: row.voiceCharacteristics ? (typeof row.voiceCharacteristics === 'string' ? JSON.parse(row.voiceCharacteristics) : row.voiceCharacteristics) : [],
            openingPhrases: row.openingPhrases ? (typeof row.openingPhrases === 'string' ? JSON.parse(row.openingPhrases) : row.openingPhrases) : [],
            closingPhrases: row.closingPhrases ? (typeof row.closingPhrases === 'string' ? JSON.parse(row.closingPhrases) : row.closingPhrases) : [],
            signatureTemplate: row.signatureTemplate || '',
            ctaPatterns: row.ctaPatterns ? (typeof row.ctaPatterns === 'string' ? JSON.parse(row.ctaPatterns) : row.ctaPatterns) : [],
            avoidPhrases: row.avoidPhrases ? (typeof row.avoidPhrases === 'string' ? JSON.parse(row.avoidPhrases) : row.avoidPhrases) : [],
            updatedAt: row.updatedAt.toISOString(),
        };
    }

    async updateGuidelines(data: Partial<BrandGuidelines>): Promise<void> {
        const existing = await prisma.brandGuidelines.findFirst();

        const updateData: any = {
            tone: data.tone,
            voiceCharacteristics: data.voiceCharacteristics,
            openingPhrases: data.openingPhrases,
            closingPhrases: data.closingPhrases,
            signatureTemplate: data.signatureTemplate,
            ctaPatterns: data.ctaPatterns,
            avoidPhrases: data.avoidPhrases,
        };

        // Remove undefined fields
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        if (existing) {
            await prisma.brandGuidelines.update({
                where: { id: existing.id },
                data: updateData
            });
        } else {
            await prisma.brandGuidelines.create({
                data: {
                    tone: data.tone || 'Professional',
                    voiceCharacteristics: data.voiceCharacteristics || [],
                    openingPhrases: data.openingPhrases || [],
                    closingPhrases: data.closingPhrases || [],
                    signatureTemplate: data.signatureTemplate || '',
                    ctaPatterns: data.ctaPatterns || [],
                    avoidPhrases: data.avoidPhrases || [],
                }
            });
        }
    }
}
