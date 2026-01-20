"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrganisationSchema = exports.createOrganisationSchema = void 0;
const zod_1 = require("zod");
exports.createOrganisationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(255, 'Name is too long'),
    description: zod_1.z.string().max(1000, 'Description is too long').optional(),
    website: zod_1.z.string().url('Invalid website URL').optional().or(zod_1.z.literal('')),
    industry: zod_1.z.string().max(255, 'Industry is too long').optional(),
    status: zod_1.z.enum(['active', 'inactive']).optional(),
    emails: zod_1.z.array(zod_1.z.object({
        value: zod_1.z.string().email('Invalid email format'),
        type: zod_1.z.string()
    })).optional(),
    phones: zod_1.z.array(zod_1.z.object({
        value: zod_1.z.string(),
        type: zod_1.z.string()
    })).optional(),
    annualRevenue: zod_1.z.number().optional(),
    numberOfEmployees: zod_1.z.number().int().optional(),
    linkedinProfile: zod_1.z.string().url('Invalid LinkedIn URL').optional().or(zod_1.z.literal('')),
    address: zod_1.z.object({
        street: zod_1.z.string().optional(),
        city: zod_1.z.string().optional(),
        state: zod_1.z.string().optional(),
        country: zod_1.z.string().optional(),
        pincode: zod_1.z.string().optional()
    }).optional()
});
exports.updateOrganisationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(255, 'Name is too long').optional(),
    description: zod_1.z.string().max(1000, 'Description is too long').optional(),
    website: zod_1.z.string().url('Invalid website URL').optional().or(zod_1.z.literal('')),
    industry: zod_1.z.string().max(255, 'Industry is too long').optional(),
    status: zod_1.z.enum(['active', 'inactive']).optional(),
    emails: zod_1.z.array(zod_1.z.object({
        value: zod_1.z.string().email('Invalid email format'),
        type: zod_1.z.string()
    })).optional(),
    phones: zod_1.z.array(zod_1.z.object({
        value: zod_1.z.string(),
        type: zod_1.z.string()
    })).optional(),
    annualRevenue: zod_1.z.number().optional(),
    numberOfEmployees: zod_1.z.number().int().optional(),
    linkedinProfile: zod_1.z.string().url('Invalid LinkedIn URL').optional().or(zod_1.z.literal('')),
    address: zod_1.z.object({
        street: zod_1.z.string().optional(),
        city: zod_1.z.string().optional(),
        state: zod_1.z.string().optional(),
        country: zod_1.z.string().optional(),
        pincode: zod_1.z.string().optional()
    }).optional()
});
//# sourceMappingURL=organisationSchema.js.map