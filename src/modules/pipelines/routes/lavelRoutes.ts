import { Router } from 'express';
import { LavelController } from '../controllers/lavelController';
import { authMiddleware } from '../../../shared/middleware/auth';

export const createLavelRoutes = (controller: LavelController) => {
    const router = Router();

    router.use(authMiddleware);

    router.post('/create', controller.create);
    router.get('/all', controller.getAll);
    router.put('/update', controller.update);
    router.delete('/delete/:levelId', controller.delete);
    router.get('/all/:pipelineId', controller.getAllByPipelineId);

    return router;
};
