import { Organization, OrganizationModel, CreateOrganizationData, UpdateOrganizationData } from '../models/Organisation';

export class OrganizationService {
    constructor(private organizationModel: OrganizationModel) { }

    async create(data: CreateOrganizationData): Promise<Organization> {
        return this.organizationModel.create(data);
    }

    async getById(id: number): Promise<Organization | null> {
        const organization = this.organizationModel.findById(id);
        return organization || null;
    }

    async getAll(options: {
        search?: string;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    } = {}): Promise<{ organizations: Organization[]; count: number }> {
        return this.organizationModel.findAll(options);
    }

    async update(id: number, data: UpdateOrganizationData): Promise<Organization | null> {
        return this.organizationModel.update(id, data);
    }

    async delete(id: number): Promise<boolean> {
        return this.organizationModel.softDelete(id);
    }

    async restore(id: number): Promise<Organization | null> {
        return this.organizationModel.restore(id);
    }
}
