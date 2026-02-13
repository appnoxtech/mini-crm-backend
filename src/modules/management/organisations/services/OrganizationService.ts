import { Organization, OrganizationModel, CreateOrganizationData, UpdateOrganizationData } from '../models/Organization';

export class OrganizationService {
    constructor(private organizationModel: OrganizationModel) { }

    async create(data: CreateOrganizationData): Promise<Organization> {
        return this.organizationModel.create(data);
    }

    async getById(id: number, companyId: number): Promise<Organization | null> {
        const organization = this.organizationModel.findById(id, companyId);
        return organization || null;
    }

    async getAll(options: {
        companyId: number;
        search?: string;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    }): Promise<{ organizations: Organization[]; count: number }> {
        return this.organizationModel.findAll(options);
    }

    async update(id: number, companyId: number, data: UpdateOrganizationData): Promise<Organization | null> {
        return this.organizationModel.update(id, companyId, data);
    }

    async searchByOrgName(query: string, companyId: number): Promise<Organization[] | null> {
        return this.organizationModel.searchByOrgName(query, companyId);
    }

    async delete(id: number, companyId: number): Promise<boolean> {
        return this.organizationModel.softDelete(id, companyId);
    }

    async restore(id: number, companyId: number): Promise<Organization | null> {
        return this.organizationModel.restore(id, companyId);
    }
}
