"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPipelineRoutes = createPipelineRoutes;
const express_1 = require("express");
const auth_1 = require("../../../shared/middleware/auth");
function createPipelineRoutes(controller) {
    const router = (0, express_1.Router)();
    // Apply auth middleware to all routes
    router.use(auth_1.authMiddleware);
    // --- PIPELINE ROUTES (Static routes first) ---
    router.post('/create', (req, res) => controller.createPipeline(req, res));
    router.get('/get', (req, res) => controller.getPipelines(req, res));
    router.get('/get/:id', (req, res) => controller.getPipelineById(req, res));
    router.put('/update/:id', (req, res) => controller.updatePipeline(req, res));
    router.delete('/delete/:id', (req, res) => controller.deletePipeline(req, res));
    // --- STAGE ROUTES (Static routes first) ---
    router.post('/stage/create', (req, res) => controller.createStage(req, res));
    router.put('/stage/update', (req, res) => controller.updateStage(req, res));
    // --- PARAMETERIZED ROUTES (Always at the end) ---
    router.get('/get/stages/:pipelineId', (req, res) => controller.getStages(req, res));
    router.patch('/reorder/stages/:pipelineId', (req, res) => controller.reorderStages(req, res));
    router.delete('/:pipelineId/stages/:stageId', (req, res) => controller.deleteStage(req, res));
    return router;
}
//# sourceMappingURL=pipelineRoutes.js.map