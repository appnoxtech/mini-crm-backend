"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDealRoutes = createDealRoutes;
const express_1 = require("express");
const auth_1 = require("../../../shared/middleware/auth");
const fileUpload_1 = require("../../../shared/middleware/fileUpload");
function createDealRoutes(controller) {
    const router = (0, express_1.Router)();
    // Apply auth middleware to all routes
    router.use(auth_1.authMiddleware);
    // Deal routes
    router.post('/create', (req, res) => controller.createDeal(req, res));
    router.get('/get', (req, res) => controller.getDeals(req, res));
    router.get('/', (req, res) => controller.searchDeals(req, res));
    router.get('/get/rotten', (req, res) => controller.getRottenDeals(req, res));
    router.get('/get/:id', (req, res) => controller.getDealById(req, res));
    router.put('/update/:dealId', (req, res) => controller.updateDeal(req, res));
    router.patch('/move/:dealId', (req, res) => controller.moveDeal(req, res));
    router.patch('/close/:dealId', (req, res) => controller.closeDeal(req, res));
    router.delete('/delete/:dealId', (req, res) => controller.deleteDeal(req, res));
    router.patch('/make-won/:dealId', (req, res) => controller.makeDealAsWon(req, res));
    router.put('/make-lost/:dealId', (req, res) => controller.makeDealAsLost(req, res));
    router.patch('/re-open/:dealId', (req, res) => controller.resetDeal(req, res));
    router.get("/deal-history/:dealId", (req, res) => controller.getDealHistory(req, res));
    router.delete('/remove-label/:dealId', (req, res) => controller.removeLabelFromDeal(req, res));
    // File upload route
    router.post('/upload/:dealId', ...fileUpload_1.fileUploadMiddleware, (req, res) => controller.uploadDealFiles(req, res));
    return router;
}
//# sourceMappingURL=dealRoutes.js.map