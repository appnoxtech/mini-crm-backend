import { z } from 'zod';

export const createOrganisationSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
    description: z.string().max(1000, 'Description is too long').optional(),
    website: z.string().url('Invalid website URL').optional().or(z.literal('')),
    industry: z.string().max(255, 'Industry is too long').optional(),
    status: z.enum(['active', 'inactive']).optional(),
    emails: z.array(z.object({
        value: z.string().email('Invalid email format'),
        type: z.string()
    })).optional(),
    phones: z.array(z.object({
        value: z.string(),
        type: z.string()
    })).optional(),
    annualRevenue: z.number().optional(),
    numberOfEmployees: z.number().int().optional(),
    linkedinProfile: z.string().url('Invalid LinkedIn URL').optional().or(z.literal('')),
    address: z.object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        pincode: z.string().optional()
    }).optional()
});

export const updateOrganisationSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name is too long').optional(),
    description: z.string().max(1000, 'Description is too long').optional(),
    website: z.string().url('Invalid website URL').optional().or(z.literal('')),
    industry: z.string().max(255, 'Industry is too long').optional(),
    status: z.enum(['active', 'inactive']).optional(),
    emails: z.array(z.object({
        value: z.string().email('Invalid email format'),
        type: z.string()
    })).optional(),
    phones: z.array(z.object({
        value: z.string(),
        type: z.string()
    })).optional(),
    annualRevenue: z.number().optional(),
    numberOfEmployees: z.number().int().optional(),
    linkedinProfile: z.string().url('Invalid LinkedIn URL').optional().or(z.literal('')),
    address: z.object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        pincode: z.string().optional()
    }).optional()
});

export type CreateOrganisationInput = z.infer<typeof createOrganisationSchema>;
export type UpdateOrganisationInput = z.infer<typeof updateOrganisationSchema>;