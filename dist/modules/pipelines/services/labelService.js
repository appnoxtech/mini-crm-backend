"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabelService = void 0;
class LabelService {
    labelModel;
    constructor(labelModel) {
        this.labelModel = labelModel;
    }
    async createlabel(userId, data) {
        if (!data.value || !data.value.trim()) {
            throw new Error('label value is required');
        }
        if (!data.color) {
            throw new Error('Color is required');
        }
        if (data.orderIndex === undefined) {
            throw new Error('Order index is required');
        }
        return this.labelModel.create({
            value: data.value.trim(),
            color: data.color,
            orderIndex: data.orderIndex,
            pipelineId: data.pipelineId,
            organizationId: data.organizationId,
            personId: data.personId,
            userId
        });
    }
    async getlabels(userId, filters = {}) {
        const page = filters.page || 1;
        const limit = filters.limit || 20;
        const offset = (page - 1) * limit;
        const result = this.labelModel.findByUserId(userId, {
            ...filters,
            limit,
            offset
        });
        return {
            labels: result.label, // Note: Model returns 'label' property
            total: result.total,
            pagination: {
                total: result.total,
                page,
                limit,
                totalPages: Math.ceil(result.total / limit)
            }
        };
    }
    async getlabelByPipelineId(pipelineId, userId) {
        const label = this.labelModel.findByPipelineId(pipelineId);
        if (!label) {
            return null;
        }
        return label;
    }
    async getlabelByOrganizationId(organizationId, userId) {
        const label = this.labelModel.findByOrganizationId(organizationId);
        if (!label) {
            return null;
        }
        return label;
    }
    async getlabelByPersonId(personId, userId) {
        const label = this.labelModel.findByPersonId(personId);
        if (!label) {
            return null;
        }
        return label;
    }
    async updatelabel(labelId, data) {
        const label = this.labelModel.findById(labelId);
        if (!label) {
            return null;
        }
        return this.labelModel.update(labelId, data) || null;
    }
    async deletelabel(labelId) {
        const label = this.labelModel.findById(labelId);
        if (!label) {
            return false;
        }
        return this.labelModel.delete(labelId);
    }
}
exports.LabelService = LabelService;
//# sourceMappingURL=labelService.js.map