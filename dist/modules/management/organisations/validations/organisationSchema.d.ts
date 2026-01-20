import { z } from 'zod';
export declare const createOrganisationSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    website: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    industry: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
    }>>;
    emails: z.ZodOptional<z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        type: z.ZodString;
    }, z.core.$strip>>>;
    phones: z.ZodOptional<z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        type: z.ZodString;
    }, z.core.$strip>>>;
    annualRevenue: z.ZodOptional<z.ZodNumber>;
    numberOfEmployees: z.ZodOptional<z.ZodNumber>;
    linkedinProfile: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    address: z.ZodOptional<z.ZodObject<{
        street: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        country: z.ZodOptional<z.ZodString>;
        pincode: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const updateOrganisationSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    website: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    industry: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<{
        active: "active";
        inactive: "inactive";
    }>>;
    emails: z.ZodOptional<z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        type: z.ZodString;
    }, z.core.$strip>>>;
    phones: z.ZodOptional<z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        type: z.ZodString;
    }, z.core.$strip>>>;
    annualRevenue: z.ZodOptional<z.ZodNumber>;
    numberOfEmployees: z.ZodOptional<z.ZodNumber>;
    linkedinProfile: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    address: z.ZodOptional<z.ZodObject<{
        street: z.ZodOptional<z.ZodString>;
        city: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        country: z.ZodOptional<z.ZodString>;
        pincode: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type CreateOrganisationInput = z.infer<typeof createOrganisationSchema>;
export type UpdateOrganisationInput = z.infer<typeof updateOrganisationSchema>;
//# sourceMappingURL=organisationSchema.d.ts.map