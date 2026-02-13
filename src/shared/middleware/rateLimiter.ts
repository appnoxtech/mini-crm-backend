import { Request, Response, NextFunction } from 'express';
import { ResponseHandler } from '../responses/responses';

const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

/**
 * Simple in-memory rate limiter
 * @param windowMs Time window in milliseconds
 * @param max Requests allowed per window
 */
export const rateLimiter = (windowMs: number, max: number) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const ip = req.ip || 'unknown';
        const now = Date.now();

        const record = rateLimitMap.get(ip) || { count: 0, lastReset: now };

        if (now - record.lastReset > windowMs) {
            record.count = 1;
            record.lastReset = now;
        } else {
            record.count++;
        }

        rateLimitMap.set(ip, record);

        if (record.count > max) {
            return ResponseHandler.error(res, 'Too many requests, please try again later', 429);
        }

        next();
    };
};
