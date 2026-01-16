import { Router } from 'express';
import { LabelController } from '../controllers/labelController';
import { authMiddleware } from '../../../shared/middleware/auth';

export const createLabelRoutes = (controller: LabelController) => {
    const router = Router();

    router.use(authMiddleware);

    router.post('/create', controller.create);
    router.get('/all', controller.getAll);
    router.put('/update', controller.update);
    router.delete('/delete/:levelId', controller.delete);
    router.get('/all/:pipelineId', controller.getAllByPipelineId);
    router.get('/organization/:organizationId', controller.getAllByOrganizationId);
    router.get('/person/:personId', controller.getAllByPersonId);

    return router;
};
