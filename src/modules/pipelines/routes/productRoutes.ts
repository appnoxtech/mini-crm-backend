import { Router } from 'express';
import { ProductController } from '../controllers/productController';
import { authMiddleware } from '../../../shared/middleware/auth';

export const createProductRoutes = (controller: ProductController): Router => {
    const router = Router();

    // Apply authentication middleware to all routes
    router.use(authMiddleware);

    router.post('/', (req, res) => controller.createProduct(req, res));
    router.put('/:id', (req, res) => controller.updateProduct(req, res));
    router.get('/deal/:dealId', (req, res) => controller.getProductsByDealId(req, res));
    router.delete('/:id', (req, res) => controller.deleteProduct(req, res));

    return router;
};
