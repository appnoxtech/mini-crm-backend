"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPersonRoutes = createPersonRoutes;
const express_1 = require("express");
const auth_1 = require("../../../../shared/middleware/auth");
function createPersonRoutes(personController) {
    const router = (0, express_1.Router)();
    // Apply auth middleware to all routes
    router.use(auth_1.authMiddleware);
    // CRUD operations
    router.get('/', (req, res) => personController.getAll(req, res));
    router.get('/search', (req, res) => personController.searchPersons(req, res));
    router.get('/:id', (req, res) => personController.getById(req, res));
    router.post('/', (req, res) => personController.create(req, res));
    router.put('/:id', (req, res) => personController.update(req, res));
    router.delete('/:id', (req, res) => personController.delete(req, res));
    // Restore soft-deleted person
    router.post('/:id/restore', (req, res) => personController.restore(req, res));
    return router;
}
//# sourceMappingURL=personRoutes.js.map