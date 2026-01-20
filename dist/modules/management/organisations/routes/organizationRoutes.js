"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrganizationRoutes = createOrganizationRoutes;
const express_1 = require("express");
const auth_1 = require("../../../../shared/middleware/auth");
const validate_1 = __importDefault(require("../../../../shared/validate"));
const organisationSchema_1 = require("../validations/organisationSchema");
function createOrganizationRoutes(organizationController) {
    const router = (0, express_1.Router)();
    // Apply auth middleware to all routes
    router.use(auth_1.authMiddleware);
    // CRUD operations
    router.get('/', (req, res) => organizationController.getAll(req, res));
    router.get('/search', (req, res) => organizationController.searchByOrgName(req, res));
    router.get('/:id', (req, res) => organizationController.getById(req, res));
    router.post('/', (0, validate_1.default)(organisationSchema_1.createOrganisationSchema), (req, res) => organizationController.create(req, res));
    router.put('/:id', (0, validate_1.default)(organisationSchema_1.updateOrganisationSchema), (req, res) => organizationController.update(req, res));
    router.delete('/:id', (req, res) => organizationController.delete(req, res));
    // Restore soft-deleted organisation
    router.post('/:id/restore', (req, res) => organizationController.restore(req, res));
    return router;
}
//# sourceMappingURL=organizationRoutes.js.map