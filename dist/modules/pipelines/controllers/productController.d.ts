import { Response } from 'express';
import { ProductService } from '../services/productService';
import { AuthenticatedRequest } from '../../../shared/types';
export declare class ProductController {
    private productService;
    constructor(productService: ProductService);
    createProduct(req: AuthenticatedRequest, res: Response): Promise<void>;
    updateProduct(req: AuthenticatedRequest, res: Response): Promise<void>;
    getProductsByDealId(req: AuthenticatedRequest, res: Response): Promise<void>;
    deleteProduct(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=productController.d.ts.map