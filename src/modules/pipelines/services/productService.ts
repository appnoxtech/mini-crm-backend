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
    }): Promise<Product> {
        return this.productModel.create({
            dealId: (data.dealId),
            userId,
            item: data.item,
            price: Number(data.price),
            quantity: Number(data.quantity),
            tax: Number(data.tax),
            amount: Number(data.amount)
        });
    }
}