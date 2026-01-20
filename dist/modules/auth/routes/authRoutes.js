"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthRoutes = createAuthRoutes;
const express_1 = require("express");
const auth_1 = require("../../../shared/middleware/auth");
const authValidation_1 = require("../validation/authValidation");
const validate_1 = __importDefault(require("../../../shared/validate"));
function createAuthRoutes(authController) {
    const router = (0, express_1.Router)();
    // Public routes
    router.post('/register', (0, validate_1.default)(authValidation_1.registerSchema), (req, res) => authController.register(req, res));
    router.post('/login', (0, validate_1.default)(authValidation_1.loginSchema), (req, res) => authController.login(req, res));
    // Protected routes
    router.get('/profile', auth_1.authMiddleware, (req, res) => authController.getProfile(req, res));
    router.put('/profile', auth_1.authMiddleware, (req, res) => authController.updateProfile(req, res));
    router.put('/change-password', auth_1.authMiddleware, (0, validate_1.default)(authValidation_1.changePasswordSchema), (req, res) => authController.changePassword(req, res));
    return router;
}
//# sourceMappingURL=authRoutes.js.map