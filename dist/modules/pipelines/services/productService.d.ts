import { Product, ProductModel } from "../models/Product";
export declare class ProductService {
    private productModel;
    constructor(productModel: ProductModel);
    createProduct(userId: number, data: {
        dealId: number;
        item: string;
        price: number;
        quantity: number;
        tax: number;
        amount: number;
        discount?: number;
        billingDate?: string;
        description?: string;
    }): Promise<Product>;
    updateProduct(id: number, userId: number, data: {
        dealId: number;
        item: string;
        price: number;
        quantity: number;
        tax: number;
        amount: number;
        discount?: number;
        billingDate?: string;
        description?: string;
    }): Promise<Product | null>;
    getProductsByDealId(dealId: number): Promise<Product[]>;
    deleteProduct(id: number): Promise<boolean>;
}
//# sourceMappingURL=productService.d.ts.map