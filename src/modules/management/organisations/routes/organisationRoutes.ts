import { Router } from 'express';
import { OrganisationController } from '../controllers/OrganisationController';
import { authMiddleware } from '../../../../shared/middleware/auth';
import validate from '../../../../shared/validate';
import { createOrganisationSchema, updateOrganisationSchema } from '../validations/organisationSchema';

export function createOrganisationRoutes(organisationController: OrganisationController): Router {
    const router = Router();

    // Apply auth middleware to all routes
    router.use(authMiddleware);

    // CRUD operations
    router.get('/', (req: any, res) => organisationController.getAll(req, res));
    router.get('/:id', (req: any, res) => organisationController.getById(req, res));
    router.post('/', validate(createOrganisationSchema), (req: any, res) => organisationController.create(req, res));
    router.put('/:id', validate(updateOrganisationSchema), (req: any, res) => organisationController.update(req, res));
    router.delete('/:id', (req: any, res) => organisationController.delete(req, res));

    // Restore soft-deleted organisation
    router.post('/:id/restore', (req: any, res) => organisationController.restore(req, res));

    return router;
}
