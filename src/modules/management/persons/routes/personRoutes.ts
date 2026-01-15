import { Router } from 'express';
import { PersonController } from '../controllers/PersonController';
import { authMiddleware } from '../../../../shared/middleware/auth';
import validate from '../../../../shared/validate';
import { createPersonSchema, updatePersonSchema } from '../validations/personSchema';

export function createPersonRoutes(personController: PersonController): Router {
    const router = Router();

    // Apply auth middleware to all routes
    router.use(authMiddleware);

    // CRUD operations
    router.get('/', (req: any, res) => personController.getAll(req, res));
    router.get('/:id', (req: any, res) => personController.getById(req, res));
    router.post('/', validate(createPersonSchema), (req: any, res) => personController.create(req, res));
    router.put('/:id', validate(updatePersonSchema), (req: any, res) => personController.update(req, res));
    router.delete('/:id', (req: any, res) => personController.delete(req, res));

    // Restore soft-deleted person
    router.post('/:id/restore', (req: any, res) => personController.restore(req, res));

    return router;
}
