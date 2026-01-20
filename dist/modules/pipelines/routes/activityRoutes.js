"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createActivityRoutes = createActivityRoutes;
const express_1 = require("express");
const auth_1 = require("../../../shared/middleware/auth");
const fileUpload_1 = require("../../../shared/middleware/fileUpload");
function createActivityRoutes(controller) {
    const router = (0, express_1.Router)();
    // Apply auth middleware to all routes
    router.use(auth_1.authMiddleware);
    // Activity routes for specific deal
    router.post('/create/:dealId', (req, res) => controller.createActivity(req, res));
    router.get('/get/:dealId', (req, res) => controller.getAllActivitiesOfDeal(req, res));
    router.put('/update/:dealId/:activityId', (req, res) => controller.updateActivity(req, res));
    router.patch('/complete/:dealId/:activityId/complete', (req, res) => controller.completeActivity(req, res));
    router.delete('/delete/:dealId/:activityId', (req, res) => controller.deleteActivity(req, res));
    router.post('/create-note/:dealId', (req, res) => controller.createNoteActivity(req, res));
    // Get deal history + all activities
    router.get('/deal-history/:dealId', (req, res) => controller.getDealHistory(req, res));
    // User-level activity routes
    router.get('/my-activities', (req, res) => controller.getActivitiesForUser(req, res));
    router.get('/upcoming-activities', (req, res) => controller.getUpcomingActivities(req, res));
    router.post('/upload/:dealId', fileUpload_1.fileUploadMiddleware, (req, res) => controller.uploadActivityFiles(req, res));
    return router;
}
//# sourceMappingURL=activityRoutes.js.map