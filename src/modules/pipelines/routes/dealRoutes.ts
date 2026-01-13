import { Router } from 'express';
import { DealController } from '../controllers/dealController';
import { authMiddleware } from '../../../shared/middleware/auth';

export function createDealRoutes(controller: DealController): Router {
    const router = Router();

    // Apply auth middleware to all routes
    router.use(authMiddleware);

    // Deal routes
    router.post('/create', (req, res) => controller.createDeal(req, res));
    router.get('/get', (req, res) => controller.getDeals(req, res));
    router.get('/get/rotten', (req, res) => controller.getRottenDeals(req, res));
    router.get('/get/:id', (req, res) => controller.getDealById(req, res));
    router.put('/update/:dealId', (req, res) => controller.updateDeal(req, res));
    router.patch('/move/:dealId', (req, res) => controller.moveDeal(req, res));
    router.patch('/close/:dealId', (req, res) => controller.closeDeal(req, res));
    router.delete('/delete/:dealId', (req, res) => controller.deleteDeal(req, res));

    return router;
}
