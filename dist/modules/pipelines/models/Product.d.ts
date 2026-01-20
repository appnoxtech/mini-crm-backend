import Database from "better-sqlite3";
import { BaseEntity } from "../../../shared/types";
export interface Product extends BaseEntity {
    dealId: number;
    userId: number;
    title: string;
    price: number;
    quantity: number;
    discount?: number;
    billingDate?: string;
    description?: string;
    tax?: number;
    amount?: number;
}
export declare class ProductModel {
    private db;
    constructor(db: Database.Database);
    initialize(): void;
    create(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Product;
    findById(id: number): Product | undefined;
    findByDealId(dealId: number): Product[];
    update(id: number, data: Partial<Product>): Product | null;
    delete(id: number): boolean;
}
//# sourceMappingURL=Product.d.ts.map