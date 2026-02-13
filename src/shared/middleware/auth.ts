import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { verifyToken } from '../../modules/auth/services/authService';
import { ResponseHandler } from '../responses/responses';
import { CompanyModel } from '../../modules/companies/models/company';

const companyModel = new CompanyModel();

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = (req.headers as any).authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return ResponseHandler.unauthorized(res, 'Unauthorized access');
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const user = verifyToken(token);

  if (!user) {
    return ResponseHandler.unauthorized(res, 'Invalid or expired token');
  }

  // check company is active
  const company = await companyModel.findById(user.companyId);
  if (!company) {
    return ResponseHandler.unauthorized(res, 'Company not found');
  }
  if (!company.isActive) {
    return ResponseHandler.unauthorized(res, 'Company is not active');
  }

  req.user = user;
  next();
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
}
