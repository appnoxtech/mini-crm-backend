"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadService = void 0;
class LeadService {
    leadModel;
    constructor(leadModel) {
        this.leadModel = leadModel;
    }
    async createLead(userId, leadData) {
        if (!leadData.name || !leadData.name.trim()) {
            throw new Error('Name is required');
        }
        return this.leadModel.createLead({
            ...leadData,
            name: leadData.name.trim(),
            company: leadData.company?.trim(),
            userId
        });
    }
    async getLeads(userId, options = {}) {
        return this.leadModel.findByUserId(userId, options);
    }
    async getLeadById(id, userId) {
        const lead = this.leadModel.findById(id);
        if (!lead || lead.userId !== userId) {
            return null;
        }
        return lead;
    }
    async updateLeadStage(id, userId, stage) {
        if (!['OPEN', 'WON', 'LOST'].includes(stage)) {
            throw new Error('Invalid stage');
        }
        return this.leadModel.updateStage(id, userId, stage);
    }
    async addActivity(id, userId, type, text) {
        const lead = this.leadModel.findById(id);
        if (!lead || lead.userId !== userId) {
            throw new Error('Lead not found');
        }
        if (!type || !text || !text.trim()) {
            throw new Error('Type and text are required');
        }
        this.leadModel.addHistory(id, type, text.trim());
    }
    async getLeadHistory(id, userId) {
        const lead = this.leadModel.findById(id);
        if (!lead || lead.userId !== userId) {
            throw new Error('Lead not found');
        }
        return this.leadModel.getHistory(id);
    }
    async deleteLead(id, userId) {
        return this.leadModel.deleteLead(id, userId);
    }
    async getStats(userId) {
        return this.leadModel.getStats(userId);
    }
}
exports.LeadService = LeadService;
//# sourceMappingURL=leadService.js.map