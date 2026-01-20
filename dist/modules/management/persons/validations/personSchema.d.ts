import { z } from 'zod';
export declare const createPersonSchema: z.ZodObject<{
    firstName: z.ZodString;
    lastName: z.ZodString;
    emails: z.ZodArray<z.ZodObject<{
        email: z.ZodString;
        label: z.ZodEnum<{
            work: "work";
            home: "home";
            other: "other";
            personal: "personal";
        }>;
    }, z.core.$strip>>;
    phones: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        number: z.ZodString;
        type: z.ZodEnum<{
            work: "work";
            home: "home";
            other: "other";
            mobile: "mobile";
        }>;
    }, z.core.$strip>>>>;
    organizationId: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const updatePersonSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    emails: z.ZodOptional<z.ZodArray<z.ZodObject<{
        email: z.ZodString;
        label: z.ZodEnum<{
            work: "work";
            home: "home";
            other: "other";
            personal: "personal";
        }>;
    }, z.core.$strip>>>;
    phones: z.ZodOptional<z.ZodArray<z.ZodObject<{
        number: z.ZodString;
        type: z.ZodEnum<{
            work: "work";
            home: "home";
            other: "other";
            mobile: "mobile";
        }>;
    }, z.core.$strip>>>;
    organizationId: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
//# sourceMappingURL=personSchema.d.ts.map