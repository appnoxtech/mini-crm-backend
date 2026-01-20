"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const validate = (schema) => {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            const error = result.error;
            const firstIssueMessage = error.issues?.[0]?.message || 'Invalid request data';
            return res.status(400).json({ error: firstIssueMessage });
        }
        req.body = result.data;
        next();
    };
};
exports.default = validate;
//# sourceMappingURL=validate.js.map