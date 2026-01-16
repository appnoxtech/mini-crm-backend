import { Router } from 'express';
import { OrganizationController } from '../controllers/OrganizationController';
import { authMiddleware } from '../../../../shared/middleware/auth';
import validate from '../../../../shared/validate';
import { createOrganisationSchema, updateOrganisationSchema } from '../validations/organisationSchema';

export function createOrganizationRoutes(organizationController: OrganizationController): Router {
    const router = Router();

    // Apply auth middleware to all routes
    router.use(authMiddleware);

    // CRUD operations
    router.get('/', (req: any, res) => organizationController.getAll(req, res));
    router.get('/search', (req: any, res) => organizationController.searchByOrgName(req, res));
    router.get('/:id', (req: any, res) => organizationController.getById(req, res));
    router.post('/', validate(createOrganisationSchema), (req: any, res) => organizationController.create(req, res));
    router.put('/:id', validate(updateOrganisationSchema), (req: any, res) => organizationController.update(req, res));
    router.delete('/:id', (req: any, res) => organizationController.delete(req, res));
    // Restore soft-deleted organisation
    router.post('/:id/restore', (req: any, res) => organizationController.restore(req, res));

    return router;
}
