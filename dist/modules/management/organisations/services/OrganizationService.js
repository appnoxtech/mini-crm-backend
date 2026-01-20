"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationService = void 0;
class OrganizationService {
    organizationModel;
    constructor(organizationModel) {
        this.organizationModel = organizationModel;
    }
    async create(data) {
        return this.organizationModel.create(data);
    }
    async getById(id) {
        const organization = this.organizationModel.findById(id);
        return organization || null;
    }
    async getAll(options = {}) {
        return this.organizationModel.findAll(options);
    }
    async update(id, data) {
        return this.organizationModel.update(id, data);
    }
    async searchByOrgName(query) {
        return this.organizationModel.searchByOrgName(query);
    }
    async delete(id) {
        return this.organizationModel.softDelete(id);
    }
    async restore(id) {
        return this.organizationModel.restore(id);
    }
}
exports.OrganizationService = OrganizationService;
//# sourceMappingURL=OrganizationService.js.map