import { Request, Response, NextFunction } from 'express';
import { AuthUser } from './auth';
export interface AuthenticatedRequest extends Request {
    user?: AuthUser;
}
export declare function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function corsMiddleware(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=middleware.d.ts.map