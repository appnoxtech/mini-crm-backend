import { prisma } from '../../../shared/prisma';
import { Prisma } from '@prisma/client';

export interface PricingTier {
    id: string;
    name: string;
    basePrice: number;
    currency: string;
    contractTerms: string;
    features: string[];
    isActive: boolean;
}

export interface DiscountRule {
    target_type: string;
    target_id: string;
    discount_percent: number;
    valid_until: string | null;
}

export class PricingModel {
    constructor(_db?: any) { }

    initialize(): void {
        // No-op with Prisma
    }

    private mapPrismaToTier(row: any): PricingTier {
        return {
            id: row.id,
            name: row.name,
            basePrice: row.basePrice,
            currency: row.currency,
            contractTerms: row.contractTerms || '',
            features: row.features ? (typeof row.features === 'string' ? JSON.parse(row.features) : row.features) : [],
            isActive: row.isActive
        };
    }

    async getAllTiers(): Promise<PricingTier[]> {
        const rows = await prisma.pricingTier.findMany({
            orderBy: { basePrice: 'asc' }
        });
        return rows.map((row: any) => this.mapPrismaToTier(row));
    }

    async getTierById(id: string): Promise<PricingTier | null> {
        const row = await prisma.pricingTier.findUnique({
            where: { id }
        });
        return row ? this.mapPrismaToTier(row) : null;
    }

    async createTier(data: Omit<PricingTier, 'id'>): Promise<string> {
        const row = await prisma.pricingTier.create({
            data: {
                name: data.name,
                basePrice: data.basePrice,
                currency: data.currency || 'EUR',
                contractTerms: data.contractTerms,
                features: data.features,
                isActive: data.isActive
            }
        });
        return row.id;
    }

    async deleteTier(id: string): Promise<void> {
        await prisma.pricingTier.delete({
            where: { id }
        });
    }

    async updateTier(id: string, data: Partial<PricingTier>): Promise<void> {
        const updateData: any = {};
        if (data.name) updateData.name = data.name;
        if (data.basePrice !== undefined) updateData.basePrice = data.basePrice;
        if (data.currency) updateData.currency = data.currency;
        if (data.contractTerms) updateData.contractTerms = data.contractTerms;
        if (data.features) updateData.features = data.features;
        if (data.isActive !== undefined) updateData.isActive = data.isActive;

        await prisma.pricingTier.update({
            where: { id },
            data: updateData
        });
    }

    async createDiscountRule(rule: DiscountRule): Promise<void> {
        await prisma.discountRule.create({
            data: {
                type: rule.target_type,
                tierId: rule.target_id,
                percentage: rule.discount_percent,
                conditions: rule.valid_until ? { validUntil: rule.valid_until } : (Prisma as any).JsonNull
            }
        });
    }
}
