"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProfileRoutes = createProfileRoutes;
const express_1 = require("express");
const auth_1 = require("../../../../shared/middleware/auth");
const fileUpload_1 = require("../../../../shared/middleware/fileUpload");
function createProfileRoutes(profileController) {
    const router = (0, express_1.Router)();
    // Apply auth middleware to all routes
    router.use(auth_1.authMiddleware);
    // Profile operations (relative to the authenticated user)
    router.get('/user', (req, res) => profileController.getProfile(req, res));
    router.put('/update', fileUpload_1.fileUploadMiddleware, (req, res) => profileController.updateProfile(req, res));
    router.delete('/delete', (req, res) => profileController.deleteProfile(req, res));
    return router;
}
//# sourceMappingURL=profileRoutes.js.map