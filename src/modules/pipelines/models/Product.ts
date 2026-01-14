import Database from "better-sqlite3";
import { BaseEntity } from "../../../shared/types";

/**
 * 
 * {
    "item": "string",
    "price": 0,
    "quantity": 1,
    "tax": 0,
    "amount": 0
}
 */

export interface Product extends BaseEntity {
    dealId: number,
    userId: number,
    item: string,
    price: number,
    quantity: number,
    tax: number,
    amount: number,
}

export class ProductModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS product (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dealId INTEGER NOT NULL,
            userId INTEGER NOT NULL,
            item TEXT NOT NULL,
            price REAL NOT NULL,
            quantity REAL NOT NULL,
            tax REAL NOT NULL,
            amount REAL NOT NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            FOREIGN KEY (dealId) REFERENCES deals(id) ON DELETE CASCADE
            )
            `);
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_product_dealId ON product(dealId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_product_item ON product(item)');

    }

    create(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Product {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
            INSERT INTO product (dealId, userId, item, price, quantity, tax, amount, createdAt, updatedAt)
            VALUES ($dealId, $userId, $item, $price, $quantity, $tax, $amount, $createdAt, $updatedAt)
        `);

        const insertData = {
            ...data,
            createdAt: now,
            updatedAt: now
        };

        const info = stmt.run(insertData);
        return {
            ...insertData,
            id: Number(info.lastInsertRowid),
        };
    }

    findById(id: number): Product | undefined {
        const stmt = this.db.prepare('SELECT * FROM product WHERE id = ?');
        return stmt.get(id) as Product | undefined;
    }

    findByDealId(dealId: number): Product[] {
        const stmt = this.db.prepare('SELECT * FROM product WHERE dealId = ?');
        return stmt.all(dealId) as Product[];
    }

    update(id: number, data: Partial<Product>): Product | null {
        const stmt = this.db.prepare(`
            UPDATE product
            SET 
                userId = $userId,
                item = $item,
                price = $price,
                quantity = $quantity,
                tax = $tax,
                amount = $amount,
                updatedAt = $updatedAt
            WHERE id = $id
        `);
        const info = stmt.run({
            id,
            ...data,
            updatedAt: new Date().toISOString()
        });
        if (info.changes === 0) {
            return null;
        }
        return this.findById(id) || null;
    }

    delete(id: number): boolean {
        const stmt = this.db.prepare('DELETE FROM product WHERE id = ?');
        const info = stmt.run(id);
        return info.changes > 0;
    }
}