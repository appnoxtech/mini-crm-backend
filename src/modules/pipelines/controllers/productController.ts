import { Response } from 'express';
import { ProductService } from '../services/productService';
import { AuthenticatedRequest } from '../../../shared/types';
import { ResponseHandler } from '../../../shared/responses/responses';

export class ProductController {
    constructor(private productService: ProductService) { }

    async createProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const product = await this.productService.createProduct(req.user.id, req.user.companyId, req.body);
            return ResponseHandler.created(res, product, 'Product created successfully');
        } catch (error: any) {
            console.error('Error creating product:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to create product');
        }
    }

    async updateProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { id } = req.params;
            const product = await this.productService.updateProduct(Number(id), req.user.id, req.user.companyId, req.body);

            if (!product) {
                return ResponseHandler.notFound(res, 'Product not found');
            }

            return ResponseHandler.success(res, product, 'Product updated successfully');
        } catch (error: any) {
            console.error('Error updating product:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to update product');
        }
    }

    async getProductsByDealId(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { dealId } = req.params;
            const products = await this.productService.getProductsByDealId(Number(dealId), req.user.companyId);

            return ResponseHandler.success(res, products, 'Products fetched successfully');
        } catch (error: any) {
            console.error('Error fetching products:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to fetch products');
        }
    }

    async deleteProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const { id } = req.params;
            const success = await this.productService.deleteProduct(Number(id), req.user.companyId);

            if (!success) {
                return ResponseHandler.notFound(res, 'Product not found');
            }

            return ResponseHandler.success(res, { success }, 'Product deleted successfully');
        } catch (error: any) {
            console.error('Error deleting product:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to delete product');
        }
    }
}
