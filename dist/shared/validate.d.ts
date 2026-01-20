import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
declare const validate: (schema: ZodSchema<any>) => (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export default validate;
//# sourceMappingURL=validate.d.ts.map