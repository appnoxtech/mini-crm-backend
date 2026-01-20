"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLabelRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../../shared/middleware/auth");
const createLabelRoutes = (controller) => {
    const router = (0, express_1.Router)();
    router.use(auth_1.authMiddleware);
    router.post('/create', controller.create);
    router.get('/all', controller.getAll);
    router.put('/update', controller.update);
    router.delete('/delete/:levelId', controller.delete);
    router.get('/all/:pipelineId', controller.getAllByPipelineId);
    router.get('/organization/:organizationId', controller.getAllByOrganizationId);
    router.get('/person/:personId', controller.getAllByPersonId);
    return router;
};
exports.createLabelRoutes = createLabelRoutes;
//# sourceMappingURL=labelRoutes.js.map