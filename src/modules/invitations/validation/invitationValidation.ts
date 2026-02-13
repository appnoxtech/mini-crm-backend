import { z } from 'zod';

export const inviteUserSchema = z.object({
    emails: z.array(z.string().email("Invalid email address"))
        .min(1, "At least one email is required")
        .max(20, "Maximum 20 emails allowed per batch"),
    role: z.enum(['admin', 'user']).default('user'),
});

export const acceptInvitationSchema = z.object({
    token: z.string().min(1, "Token is required"),
    password: z.string()
        .min(8, "Password must be at least 8 characters")
        .regex(/[A-Z]/, "Password must include at least one uppercase letter")
        .regex(/[0-9]/, "Password must include at least one number")
        .regex(/[^A-Za-z0-9]/, "Password must include at least one special character"),
    name: z.string().min(3, "Name must be at least 3 characters"),
    phone: z.string().optional(),
});
