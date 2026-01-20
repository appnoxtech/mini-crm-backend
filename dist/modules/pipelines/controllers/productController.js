"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductController = void 0;
const responses_1 = require("../../../shared/responses/responses");
class ProductController {
    productService;
    constructor(productService) {
        this.productService = productService;
    }
    async createProduct(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const product = await this.productService.createProduct(req.user.id, req.body);
            return responses_1.ResponseHandler.created(res, product, 'Product created successfully');
        }
        catch (error) {
            console.error('Error creating product:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to create product');
        }
    }
    async updateProduct(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { id } = req.params;
            const product = await this.productService.updateProduct(Number(id), req.user.id, req.body);
            if (!product) {
                return responses_1.ResponseHandler.notFound(res, 'Product not found');
            }
            return responses_1.ResponseHandler.success(res, product, 'Product updated successfully');
        }
        catch (error) {
            console.error('Error updating product:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to update product');
        }
    }
    async getProductsByDealId(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { dealId } = req.params;
            const products = await this.productService.getProductsByDealId(Number(dealId));
            return responses_1.ResponseHandler.success(res, products, 'Products fetched successfully');
        }
        catch (error) {
            console.error('Error fetching products:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to fetch products');
        }
    }
    async deleteProduct(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.unauthorized(res, 'User not authenticated');
            }
            const { id } = req.params;
            const success = await this.productService.deleteProduct(Number(id));
            if (!success) {
                return responses_1.ResponseHandler.notFound(res, 'Product not found');
            }
            return responses_1.ResponseHandler.success(res, { success }, 'Product deleted successfully');
        }
        catch (error) {
            console.error('Error deleting product:', error);
            return responses_1.ResponseHandler.internalError(res, error.message || 'Failed to delete product');
        }
    }
}
exports.ProductController = ProductController;
//# sourceMappingURL=productController.js.map