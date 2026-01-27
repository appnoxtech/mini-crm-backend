import { z } from 'zod';

// Register schema
export const registerSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  email: z.string()
    .email("Invalid email address")
  ,
  password: z.string().min(6, "Password must be at least 6 characters"),

  // Add validation for emailProvider if needed
  emailProvider: z.string()
    .email("Invalid email provider")
    .optional(),

  // Fix emailConfig to have same validation as email
  emailConfig: z.string()
    .email("Invalid email config")
    .refine((email) => {
      const lower = email.toLowerCase();
      return (
        lower.endsWith('@gmail.com') ||
        lower.endsWith('@googlemail.com') ||
        lower.endsWith('@outlook.com') ||
        lower.endsWith('@hotmail.com') ||
        lower.endsWith('@live.com')
      );
    }, {
      message: "Only Gmail or Outlook emails allowed for emailConfig"
    })
    .nullable()
    .optional(),
}).strict(); // Add .strict() to reject unknown fields


export const loginSchema = z.object({
  email: z.string()
    .email("Invalid email address"),
  password: z.string()
    .min(6, "Password must be at least 6 characters")
});

export const changePasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  currentPassword: z.string().min(6, "Password must be at least 6 characters")
})
