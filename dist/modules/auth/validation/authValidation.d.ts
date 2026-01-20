import { z } from 'zod';
export declare const registerSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    emailProvider: z.ZodOptional<z.ZodString>;
    emailConfig: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strict>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const changePasswordSchema: z.ZodObject<{
    newPassword: z.ZodString;
    currentPassword: z.ZodString;
}, z.core.$strip>;
//# sourceMappingURL=authValidation.d.ts.map