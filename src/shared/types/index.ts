// Shared types used across all modules
import { Request } from 'express';

export interface BaseEntity {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  params: any;
}

// Common API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  count: number;
  total?: number;
  page?: number;
  limit?: number;
}
