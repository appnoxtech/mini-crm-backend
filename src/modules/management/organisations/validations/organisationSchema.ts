import { z } from 'zod';

export const createOrganisationSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name is too long'),
    description: z.string().max(1000, 'Description is too long').optional(),
    website: z.string().url('Invalid website URL').optional().or(z.literal('')),
});

export const updateOrganisationSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name is too long').optional(),
    description: z.string().max(1000, 'Description is too long').optional(),
    website: z.string().url('Invalid website URL').optional().or(z.literal('')),
});

export type CreateOrganisationInput = z.infer<typeof createOrganisationSchema>;
export type UpdateOrganisationInput = z.infer<typeof updateOrganisationSchema>;
