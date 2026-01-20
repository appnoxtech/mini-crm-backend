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
    stack?: string;
}
export declare enum ErrorCodes {
    VALIDATION_ERROR = "VALIDATION_ERROR",
    INVALID_INPUT = "INVALID_INPUT",
    UNAUTHORIZED = "UNAUTHORIZED",
    INVALID_TOKEN = "INVALID_TOKEN",
    TOKEN_EXPIRED = "TOKEN_EXPIRED",
    FORBIDDEN = "FORBIDDEN",
    INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
    NOT_FOUND = "NOT_FOUND",
    USER_NOT_FOUND = "USER_NOT_FOUND",
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
    ALREADY_EXISTS = "ALREADY_EXISTS",
    USER_ALREADY_EXISTS = "USER_ALREADY_EXISTS",
    EMAIL_ALREADY_EXISTS = "EMAIL_ALREADY_EXISTS",
    DUPLICATE_ENTRY = "DUPLICATE_ENTRY",
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
    DATABASE_ERROR = "DATABASE_ERROR",
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR"
}
export declare class ResponseHandler {
    static success<T>(res: any, data: T, message?: string, statusCode?: number): any;
    static created<T>(res: any, data: T, message?: string): any;
    static noContent(res: any): any;
    static error(res: any, message: string, statusCode?: number, errorCode?: ErrorCodes, details?: any): any;
    static validationError(res: any, details: any, message?: string): any;
    static unauthorized(res: any, message?: string): any;
    static forbidden(res: any, message?: string): any;
    static notFound(res: any, message?: string): any;
    static conflict(res: any, message?: string, details?: any): any;
    static internalError(res: any, message?: string, details?: any): any;
    static databaseError(res: any, message?: string, details?: any): any;
}
//# sourceMappingURL=responses.d.ts.map