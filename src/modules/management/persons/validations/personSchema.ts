import { z } from 'zod';

// Email label enum
const emailLabelEnum = z.enum(['work', 'home', 'other']);

// Phone type enum
const phoneTypeEnum = z.enum(['home', 'work', 'mobile', 'other']);

// Email object schema
const emailSchema = z.object({
    email: z.string().email('Invalid email address'),
    label: emailLabelEnum
});

// Phone object schema
const phoneSchema = z.object({
    number: z
        .string()
        // .regex(/^\d+$/, 'Phone number must contain only digits')
        .min(8, 'Phone number must be at least 8 digits')
        .max(15, 'Phone number must not exceed 15 digits'),
    type: phoneTypeEnum
});

export const createPersonSchema = z.object({
    firstName: z.string().min(1, 'First name is required').max(100, 'First name is too long'),
    lastName: z.string().min(1, 'Last name is required').max(100, 'Last name is too long'),
    emails: z.array(emailSchema).min(1, 'At least one email is required'),
    phones: z.array(phoneSchema).optional().default([]),
    organizationId: z.number().int().positive().optional()
});

export const updatePersonSchema = z.object({
    firstName: z.string().min(1, 'First name is required').max(100, 'First name is too long').optional(),
    lastName: z.string().min(1, 'Last name is required').max(100, 'Last name is too long').optional(),
    emails: z.array(emailSchema).min(1, 'At least one email is required').optional(),
    phones: z.array(phoneSchema).optional(),
    organizationId: z.number().int().positive().optional()
});

export type CreatePersonInput = z.infer<typeof createPersonSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
