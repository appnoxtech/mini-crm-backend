export interface ApiResponse<T = any> {
    success: boolean;
    statusCode?: number;
    message: string;
    data?: T;
    error?: ErrorDetail;
}

export interface ErrorDetail {
    code: string;
    details?: any;
    stack?: string; // Only in development
}

export enum ErrorCodes {
    // Validation Errors (400)
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    INVALID_INPUT = 'INVALID_INPUT',

    // Authentication Errors (401)
    UNAUTHORIZED = 'UNAUTHORIZED',
    INVALID_TOKEN = 'INVALID_TOKEN',
    TOKEN_EXPIRED = 'TOKEN_EXPIRED',

    // Authorization Errors (403)
    FORBIDDEN = 'FORBIDDEN',
    INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

    // Not Found Errors (404)
    NOT_FOUND = 'NOT_FOUND',
    USER_NOT_FOUND = 'USER_NOT_FOUND',
    RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',

    // Conflict Errors (409)
    ALREADY_EXISTS = 'ALREADY_EXISTS',
    USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
    EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
    DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',

    // Server Errors (500)
    INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
    DATABASE_ERROR = 'DATABASE_ERROR',
    EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

// ============================================
// 2. Response Helper Class
// ============================================

export class ResponseHandler {

    // Success Response
    static success<T>(
        res: any,
        data: T,
        message: string = 'Success',
        statusCode: number = 200
    ) {
        const response: ApiResponse<T> = {
            success: true,
            message,
            data,
        };

        return res.status(statusCode).json(response);
    }

    // Created Response (201)
    static created<T>(
        res: any,
        data: T,
        message: string = 'Resource created successfully'
    ) {
        return this.success(res, data, message, 201);
    }

    // No Content Response (204)
    static noContent(res: any) {
        return res.status(204).send();
    }

    // Error Response
    static error(
        res: any,
        message: string,
        statusCode: number = 500,
        errorCode: ErrorCodes = ErrorCodes.INTERNAL_SERVER_ERROR,
        details?: any
    ) {
        const response: ApiResponse = {
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

    // Bad Request (400)
    static badRequest(res: any, message: string = 'Bad request', details?: any) {
        return this.error(res, message, 400, ErrorCodes.INVALID_INPUT, details);
    }

    // Validation Error (400)
    static validationError(res: any, details: any, message: string = 'Validation failed') {
        return this.error(res, message, 400, ErrorCodes.VALIDATION_ERROR, details);
    }

    // Unauthorized (401)
    static unauthorized(res: any, message: string = 'Unauthorized access') {
        return this.error(res, message, 401, ErrorCodes.UNAUTHORIZED);
    }

    // Forbidden (403)
    static forbidden(res: any, message: string = 'Access forbidden') {
        return this.error(res, message, 403, ErrorCodes.FORBIDDEN);
    }

    // Not Found (404)
    static notFound(res: any, message: string = 'Resource not found') {
        return this.error(res, message, 404, ErrorCodes.NOT_FOUND);
    }

    // Conflict/Duplicate (409)
    static conflict(res: any, message: string = 'Resource already exists', details?: any) {
        return this.error(res, message, 409, ErrorCodes.ALREADY_EXISTS, details);
    }

    // Internal Server Error (500)
    static internalError(res: any, message: string = 'Internal server error', details?: any) {
        return this.error(res, message, 500, ErrorCodes.INTERNAL_SERVER_ERROR, details);
    }

    // Database Error (500)
    static databaseError(res: any, message: string = 'Database error occurred', details?: any) {
        return this.error(res, message, 500, ErrorCodes.DATABASE_ERROR, details);
    }
}
