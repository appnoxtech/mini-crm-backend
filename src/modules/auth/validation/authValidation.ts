import { z } from 'zod';

// Register schema
export const registerSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  email: z.string()
    .email("Invalid email address")
  ,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must include at least one uppercase letter")
    .regex(/[0-9]/, "Password must include at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must include at least one special character"),


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
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must include at least one uppercase letter")
    .regex(/[0-9]/, "Password must include at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must include at least one special character")
});

export const changePasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must include at least one uppercase letter")
    .regex(/[0-9]/, "Password must include at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must include at least one special character"),
  currentPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must include at least one uppercase letter")
    .regex(/[0-9]/, "Password must include at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must include at least one special character")
})

export const forgotPasswordSchema = z.object({
  email: z.string()
    .email("Invalid email address")
})

export const verifyOtpSchema = z.object({
  email: z.string()
    .email("Invalid email address"),
  otp: z.string()
    .length(6, "OTP must be 6 digits")
    .regex(/^[0-9]{6}$/, "OTP must be a 6-digit number")
})

export const resetPasswordSchema = z.object({
  email: z.string()
    .email("Invalid email address"),
  otp: z.string()
    .length(6, "OTP must be 6 digits")
    .regex(/^[0-9]{6}$/, "OTP must be a 6-digit number"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must include at least one uppercase letter")
    .regex(/[0-9]/, "Password must include at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must include at least one special character")
})
