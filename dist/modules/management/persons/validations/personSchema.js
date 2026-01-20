"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePersonSchema = exports.createPersonSchema = void 0;
const zod_1 = require("zod");
// Email label enum
const emailLabelEnum = zod_1.z.enum(['work', 'home', 'other', 'personal']);
// Phone type enum
const phoneTypeEnum = zod_1.z.enum(['home', 'work', 'mobile', 'other']);
// Email object schema
const emailSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    label: emailLabelEnum
});
// Phone object schema
const phoneSchema = zod_1.z.object({
    number: zod_1.z
        .string()
        // .regex(/^\d+$/, 'Phone number must contain only digits')
        .min(8, 'Phone number must be at least 8 digits')
        .max(15, 'Phone number must not exceed 15 digits'),
    type: phoneTypeEnum
});
exports.createPersonSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'First name is required').max(100, 'First name is too long'),
    lastName: zod_1.z.string().min(1, 'Last name is required').max(100, 'Last name is too long'),
    emails: zod_1.z.array(emailSchema).min(1, 'At least one email is required'),
    phones: zod_1.z.array(phoneSchema).optional().default([]),
    organizationId: zod_1.z.number().int().positive().optional()
});
exports.updatePersonSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'First name is required').max(100, 'First name is too long').optional(),
    lastName: zod_1.z.string().min(1, 'Last name is required').max(100, 'Last name is too long').optional(),
    emails: zod_1.z.array(emailSchema).min(1, 'At least one email is required').optional(),
    phones: zod_1.z.array(phoneSchema).optional(),
    organizationId: zod_1.z.number().int().positive().optional()
});
//# sourceMappingURL=personSchema.js.map