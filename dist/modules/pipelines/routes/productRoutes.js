"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProductRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../../shared/middleware/auth");
const createProductRoutes = (controller) => {
    const router = (0, express_1.Router)();
    // Apply authentication middleware to all routes
    router.use(auth_1.authMiddleware);
    router.post('/', (req, res) => controller.createProduct(req, res));
    router.put('/:id', (req, res) => controller.updateProduct(req, res));
    router.get('/deal/:dealId', (req, res) => controller.getProductsByDealId(req, res));
    router.delete('/:id', (req, res) => controller.deleteProduct(req, res));
    return router;
};
exports.createProductRoutes = createProductRoutes;
//# sourceMappingURL=productRoutes.js.map