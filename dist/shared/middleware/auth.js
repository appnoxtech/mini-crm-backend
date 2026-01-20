"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.corsMiddleware = corsMiddleware;
const authService_1 = require("../../modules/auth/services/authService");
const responses_1 = require("../responses/responses");
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return responses_1.ResponseHandler.unauthorized(res, 'Unauthorized access');
    }
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const user = (0, authService_1.verifyToken)(token);
    if (!user) {
        return responses_1.ResponseHandler.unauthorized(res, 'Invalid or expired token');
    }
    req.user = user;
    next();
}
function corsMiddleware(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    }
    else {
        next();
    }
}
//# sourceMappingURL=auth.js.map