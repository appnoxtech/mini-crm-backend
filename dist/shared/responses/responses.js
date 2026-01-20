"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseHandler = exports.ErrorCodes = void 0;
var ErrorCodes;
(function (ErrorCodes) {
    // Validation Errors (400)
    ErrorCodes["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCodes["INVALID_INPUT"] = "INVALID_INPUT";
    // Authentication Errors (401)
    ErrorCodes["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorCodes["INVALID_TOKEN"] = "INVALID_TOKEN";
    ErrorCodes["TOKEN_EXPIRED"] = "TOKEN_EXPIRED";
    // Authorization Errors (403)
    ErrorCodes["FORBIDDEN"] = "FORBIDDEN";
    ErrorCodes["INSUFFICIENT_PERMISSIONS"] = "INSUFFICIENT_PERMISSIONS";
    // Not Found Errors (404)
    ErrorCodes["NOT_FOUND"] = "NOT_FOUND";
    ErrorCodes["USER_NOT_FOUND"] = "USER_NOT_FOUND";
    ErrorCodes["RESOURCE_NOT_FOUND"] = "RESOURCE_NOT_FOUND";
    // Conflict Errors (409)
    ErrorCodes["ALREADY_EXISTS"] = "ALREADY_EXISTS";
    ErrorCodes["USER_ALREADY_EXISTS"] = "USER_ALREADY_EXISTS";
    ErrorCodes["EMAIL_ALREADY_EXISTS"] = "EMAIL_ALREADY_EXISTS";
    ErrorCodes["DUPLICATE_ENTRY"] = "DUPLICATE_ENTRY";
    // Server Errors (500)
    ErrorCodes["INTERNAL_SERVER_ERROR"] = "INTERNAL_SERVER_ERROR";
    ErrorCodes["DATABASE_ERROR"] = "DATABASE_ERROR";
    ErrorCodes["EXTERNAL_SERVICE_ERROR"] = "EXTERNAL_SERVICE_ERROR";
})(ErrorCodes || (exports.ErrorCodes = ErrorCodes = {}));
// ============================================
// 2. Response Helper Class
// ============================================
class ResponseHandler {
    // Success Response
    static success(res, data, message = 'Success', statusCode = 200) {
        const response = {
            success: true,
            message,
            data,
        };
        return res.status(statusCode).json(response);
    }
    // Created Response (201)
    static created(res, data, message = 'Resource created successfully') {
        return this.success(res, data, message, 201);
    }
    // No Content Response (204)
    static noContent(res) {
        return res.status(204).send();
    }
    // Error Response
    static error(res, message, statusCode = 500, errorCode = ErrorCodes.INTERNAL_SERVER_ERROR, details) {
        const response = {
            success: false,
            message,
            error: {
                code: errorCode,
                details,
                stack: process.env.NODE_ENV === 'development' ? new Error().stack : undefined,
            }
        };
        return res.status(statusCode).json(response);
    }
    // Validation Error (400)
    static validationError(res, details, message = 'Validation failed') {
        return this.error(res, message, 400, ErrorCodes.VALIDATION_ERROR, details);
    }
    // Unauthorized (401)
    static unauthorized(res, message = 'Unauthorized access') {
        return this.error(res, message, 401, ErrorCodes.UNAUTHORIZED);
    }
    // Forbidden (403)
    static forbidden(res, message = 'Access forbidden') {
        return this.error(res, message, 403, ErrorCodes.FORBIDDEN);
    }
    // Not Found (404)
    static notFound(res, message = 'Resource not found') {
        return this.error(res, message, 404, ErrorCodes.NOT_FOUND);
    }
    // Conflict/Duplicate (409)
    static conflict(res, message = 'Resource already exists', details) {
        return this.error(res, message, 409, ErrorCodes.ALREADY_EXISTS, details);
    }
    // Internal Server Error (500)
    static internalError(res, message = 'Internal server error', details) {
        return this.error(res, message, 500, ErrorCodes.INTERNAL_SERVER_ERROR, details);
    }
    // Database Error (500)
    static databaseError(res, message = 'Database error occurred', details) {
        return this.error(res, message, 500, ErrorCodes.DATABASE_ERROR, details);
    }
}
exports.ResponseHandler = ResponseHandler;
//# sourceMappingURL=responses.js.map