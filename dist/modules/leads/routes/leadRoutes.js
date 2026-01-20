"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLeadRoutes = createLeadRoutes;
const express_1 = require("express");
const auth_1 = require("../../../shared/middleware/auth");
const validate_1 = __importDefault(require("../../../shared/validate"));
const leadSchema_1 = require("../validations/leadSchema");
function createLeadRoutes(leadController) {
    const router = (0, express_1.Router)();
    // Apply auth middleware to all leads routes
    router.use(auth_1.authMiddleware);
    // Lead CRUD operations
    router.get('/get', (req, res) => leadController.getLeads(req, res));
    router.post('/create', (0, validate_1.default)(leadSchema_1.createLeadSchema), (req, res) => leadController.createLead(req, res));
    router.delete('/:id', (req, res) => leadController.deleteLead(req, res));
    // Lead stage management
    router.post('/:id/stage', (req, res) => leadController.updateLeadStage(req, res));
    // Lead activity
    router.post('/:id/activity', (0, validate_1.default)(leadSchema_1.addActivitySchema), (req, res) => leadController.addActivity(req, res));
    router.get('/:id/history', (req, res) => leadController.getLeadHistory(req, res));
    // Statistics
    router.get('/stats', (req, res) => leadController.getStats(req, res));
    return router;
}
//# sourceMappingURL=leadRoutes.js.map