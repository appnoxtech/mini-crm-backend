"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePasswordSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
// Register schema
exports.registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(3, "Name must be at least 3 characters"),
    email: zod_1.z.string()
        .email("Invalid email address")
        .refine((email) => {
        const lower = email.toLowerCase();
        return (lower.endsWith('@gmail.com') ||
            lower.endsWith('@googlemail.com') ||
            lower.endsWith('@outlook.com') ||
            lower.endsWith('@hotmail.com') ||
            lower.endsWith('@live.com'));
    }, {
        message: "Only Gmail or Outlook emails are allowed"
    }),
    password: zod_1.z.string().min(6, "Password must be at least 6 characters"),
    // Add validation for emailProvider if needed
    emailProvider: zod_1.z.string()
        .email("Invalid email provider")
        .optional(),
    // Fix emailConfig to have same validation as email
    emailConfig: zod_1.z.string()
        .email("Invalid email config")
        .refine((email) => {
        const lower = email.toLowerCase();
        return (lower.endsWith('@gmail.com') ||
            lower.endsWith('@googlemail.com') ||
            lower.endsWith('@outlook.com') ||
            lower.endsWith('@hotmail.com') ||
            lower.endsWith('@live.com'));
    }, {
        message: "Only Gmail or Outlook emails allowed for emailConfig"
    })
        .nullable()
        .optional(),
}).strict(); // Add .strict() to reject unknown fields
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string()
        .email("Invalid email address")
        .refine((email) => {
        const lower = email.toLowerCase();
        return (lower.endsWith('@gmail.com') ||
            lower.endsWith('@googlemail.com') ||
            lower.endsWith('@outlook.com') ||
            lower.endsWith('@hotmail.com') ||
            lower.endsWith('@live.com'));
    }, {
        message: "Only Gmail or Outlook emails are allowed"
    }),
    password: zod_1.z.string()
        .min(6, "Password must be at least 6 characters")
});
exports.changePasswordSchema = zod_1.z.object({
    newPassword: zod_1.z.string().min(6, "Password must be at least 6 characters"),
    currentPassword: zod_1.z.string().min(6, "Password must be at least 6 characters")
});
//# sourceMappingURL=authValidation.js.map