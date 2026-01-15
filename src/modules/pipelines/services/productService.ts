import { Product, ProductModel } from "../models/Product";

export class ProductService {
    constructor(private productModel: ProductModel) { }

    async createProduct(userId: number, data: {
        dealId: number;
        item: string;
        price: number;
        quantity: number;
        tax: number;
        amount: number;
        discount?: number;
        billingDate?: string;
        description?: string;

    }): Promise<Product> {
        return this.productModel.create({
            dealId: (data.dealId),
            userId,
            title: data.item,
            price: Number(data.price),
            quantity: Number(data.quantity),
            tax: Number(data.tax),
            amount: Number(data.amount),
            discount: data.discount ? Number(data.discount) : undefined,
            billingDate: data.billingDate ? data.billingDate : undefined,
            description: data.description ? data.description : undefined

        });
    }
    async updateProduct(id: number, userId: number, data: {
        dealId: number;
        item: string;
        price: number;
        quantity: number;
        tax: number;
        amount: number;
        discount?: number;
        billingDate?: string;
        description?: string;

    }): Promise<Product | null> {
        return this.productModel.update(id, {
            dealId: (data.dealId),
            userId,
            title: data.item,
            price: Number(data.price),
            quantity: Number(data.quantity),
            tax: Number(data.tax),
            amount: Number(data.amount),
            discount: data.discount ? Number(data.discount) : undefined,
            billingDate: data.billingDate ? data.billingDate : undefined,
            description: data.description ? data.description : undefined

        });
    }


    // get all products by deal id
    async getProductsByDealId(dealId: number): Promise<Product[]> {
        return this.productModel.findByDealId(dealId);
    }

    async deleteProduct(id: number): Promise<boolean> {
        return this.productModel.delete(id);
    }
}