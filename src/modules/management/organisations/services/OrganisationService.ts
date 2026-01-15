import { Organisation, OrganisationModel, CreateOrganisationData, UpdateOrganisationData } from '../models/Organisation';

export class OrganisationService {
    constructor(private organisationModel: OrganisationModel) { }

    async create(data: CreateOrganisationData): Promise<Organisation> {
        return this.organisationModel.create(data);
    }

    async getById(id: number): Promise<Organisation | null> {
        const organisation = this.organisationModel.findById(id);
        return organisation || null;
    }

    async getAll(options: {
        search?: string;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    } = {}): Promise<{ organisations: Organisation[]; count: number }> {
        return this.organisationModel.findAll(options);
    }

    async update(id: number, data: UpdateOrganisationData): Promise<Organisation | null> {
        return this.organisationModel.update(id, data);
    }

    async delete(id: number): Promise<boolean> {
        return this.organisationModel.softDelete(id);
    }

    async restore(id: number): Promise<Organisation | null> {
        return this.organisationModel.restore(id);
    }
}
