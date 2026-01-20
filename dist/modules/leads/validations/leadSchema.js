"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addActivitySchema = exports.createLeadSchema = void 0;
const zod_1 = require("zod");
exports.createLeadSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name is required'),
    company: zod_1.z.string().optional(),
    value: zod_1.z.number().optional(),
    notes: zod_1.z.string().optional(),
});
exports.addActivitySchema = zod_1.z.object({
    type: zod_1.z.string().min(1, 'Type is required'),
    text: zod_1.z.string().min(1, 'Text is required'),
});
//# sourceMappingURL=leadSchema.js.map