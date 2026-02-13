import { Router } from 'express';
import { CompanyController } from '../controllers/companyController';
import { authMiddleware } from '../../../shared/middleware/auth';

export function createCompanyRoutes(controller: CompanyController): Router {
    const router = Router();

    // Apply auth middleware to all routes
    router.use(authMiddleware);

    router.post('/create', (req, res) => controller.createCompany(req, res));
    router.get('/get-my-companies', (req, res) => controller.getMyCompanies(req, res));
    router.get('/companyId/:id', (req, res) => controller.getCompanyById(req, res));
    router.put('/update-company/:id', (req, res) => controller.updateCompany(req, res));
    router.delete('/delete-company/:id', (req, res) => controller.deleteCompany(req, res));

    // invite user to company
    // router.post('/invite-user', (req, res) => controller.inviteUser(req, res));

    return router;
}
