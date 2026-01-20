"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductService = void 0;
class ProductService {
    productModel;
    constructor(productModel) {
        this.productModel = productModel;
    }
    async createProduct(userId, data) {
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
    async updateProduct(id, userId, data) {
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
    async getProductsByDealId(dealId) {
        return this.productModel.findByDealId(dealId);
    }
    async deleteProduct(id) {
        return this.productModel.delete(id);
    }
}
exports.ProductService = ProductService;
//# sourceMappingURL=productService.js.map