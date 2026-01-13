import { Router } from 'express';
import { PipelineController } from '../controllers/pipelineController';
import { authMiddleware } from '../../../shared/middleware/auth';

export function createPipelineRoutes(controller: PipelineController): Router {
    const router = Router();

    // Apply auth middleware to all routes
    router.use(authMiddleware);


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
