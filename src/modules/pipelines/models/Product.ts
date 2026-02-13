import { prisma } from "../../../shared/prisma";
import { BaseEntity } from "../../../shared/types";

export interface Product extends BaseEntity {
    dealId: number,
    userId: number,
    companyId: number,
    title: string,
    price: number,
    quantity: number,
    discount?: number,
    billingDate?: string,
    description?: string,
    tax?: number,
    amount?: number,
}

export class ProductModel {
    constructor(_db?: any) { }

    initialize(): void {
        // No-op with Prisma
    }

    async create(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
        const product = await prisma.product.create({
            data: {
                dealId: data.dealId,
                userId: data.userId,
                companyId: data.companyId,
                title: data.title,
                price: data.price,
                quantity: data.quantity,
                tax: data.tax || 0,
                amount: data.amount || 0,
                discount: data.discount || null,
                billingDate: data.billingDate || null,
                description: data.description || null
            }
        });

        return this.mapPrismaProductToProduct(product);
    }

    async findById(id: number, companyId?: number): Promise<Product | null> {
        const product = await prisma.product.findFirst({
            where: {
                id,
                ...(companyId && { companyId })
            }
        });
        return product ? this.mapPrismaProductToProduct(product) : null;
    }

    async findByDealId(dealId: number, companyId: number): Promise<Product[]> {
        const rows = await prisma.product.findMany({
            where: { dealId, companyId }
        });
        return rows.map((r: any) => this.mapPrismaProductToProduct(r));
    }

    async update(id: number, companyId: number, data: Partial<Product>): Promise<Product | null> {
        try {
            const updated = await prisma.product.update({
                where: {
                    id,
                    companyId
                },
                data: {
                    ...(data.userId !== undefined && { userId: data.userId }),
                    ...(data.title !== undefined && { title: data.title }),
                    ...(data.price !== undefined && { price: data.price }),
                    ...(data.quantity !== undefined && { quantity: data.quantity }),
                    ...(data.tax !== undefined && { tax: data.tax }),
                    ...(data.amount !== undefined && { amount: data.amount }),
                    ...(data.discount !== undefined && { discount: data.discount }),
                    ...(data.billingDate !== undefined && { billingDate: data.billingDate }),
                    ...(data.description !== undefined && { description: data.description }),
                    updatedAt: new Date()
                }
            });
            return this.mapPrismaProductToProduct(updated);
        } catch (error) {
            return null;
        }
    }

    async delete(id: number, companyId: number): Promise<boolean> {
        try {
            await prisma.product.delete({
                where: {
                    id,
                    companyId
                }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    private mapPrismaProductToProduct(p: any): Product {
        return {
            id: p.id,
            dealId: p.dealId,
            userId: p.userId,
            companyId: p.companyId,
            title: p.title,
            price: p.price,
            quantity: p.quantity,
            tax: p.tax,
            amount: p.amount,
            discount: p.discount || undefined,
            billingDate: p.billingDate || undefined,
            description: p.description || undefined,
            createdAt: p.createdAt.toISOString(),
            updatedAt: p.updatedAt.toISOString()
        };
    }
}