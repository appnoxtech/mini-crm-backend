import { z } from 'zod';
export declare const createLeadSchema: z.ZodObject<{
    name: z.ZodString;
    company: z.ZodOptional<z.ZodString>;
    value: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const addActivitySchema: z.ZodObject<{
    type: z.ZodString;
    text: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=leadSchema.d.ts.map