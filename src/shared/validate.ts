import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';


const validate = (schema: ZodSchema<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const error = result.error as ZodError<any>;
      const firstIssueMessage = error.issues?.[0]?.message || 'Invalid request data';
      return res.status(400).json({ error: firstIssueMessage });
    }

    req.body = result.data;
    next();
  };
};

export default validate