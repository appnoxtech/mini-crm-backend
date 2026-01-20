import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
export declare function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): any;
export declare function corsMiddleware(req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=auth.d.ts.map