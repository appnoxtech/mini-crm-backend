"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductModel = void 0;
class ProductModel {
    db;
    constructor(db) {
        this.db = db;
    }
    initialize() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS product (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dealId INTEGER NOT NULL,
            userId INTEGER NOT NULL,
            title TEXT NOT NULL,
            price REAL NOT NULL,
            quantity REAL NOT NULL,
            tax REAL NOT NULL,
            amount REAL NOT NULL,
            discount REAL,
            billingDate TEXT,
            description TEXT,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            FOREIGN KEY (dealId) REFERENCES deals(id) ON DELETE CASCADE
            )
            `);
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_product_dealId ON product(dealId)');
        this.db.exec('CREATE INDEX IF NOT EXISTS idx_product_title ON product(title)');
    }
    create(data) {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
            INSERT INTO product (dealId, userId, title, price, quantity,tax, amount, discount, billingDate, description, createdAt, updatedAt)
            VALUES ($dealId, $userId, $title, $price, $quantity, $tax, $amount, $discount, $billingDate, $description, $createdAt, $updatedAt)
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
    findById(id) {
        const stmt = this.db.prepare('SELECT * FROM product WHERE id = ?');
        return stmt.get(id);
    }
    findByDealId(dealId) {
        const stmt = this.db.prepare('SELECT * FROM product WHERE dealId = ?');
        return stmt.all(dealId);
    }
    update(id, data) {
        const stmt = this.db.prepare(`
            UPDATE product
            SET 
                userId = $userId,
                title = $title,
                price = $price,
                quantity = $quantity,
                tax = $tax,
                amount = $amount,
                discount = $discount,
                billingDate = $billingDate,
                description = $description,
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
    delete(id) {
        const stmt = this.db.prepare('DELETE FROM product WHERE id = ?');
        const info = stmt.run(id);
        return info.changes > 0;
    }
}
exports.ProductModel = ProductModel;
//# sourceMappingURL=Product.js.map