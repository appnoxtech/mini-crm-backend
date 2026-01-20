import { Organization, OrganizationModel, CreateOrganizationData, UpdateOrganizationData } from '../models/Organization';
export declare class OrganizationService {
    private organizationModel;
    constructor(organizationModel: OrganizationModel);
    create(data: CreateOrganizationData): Promise<Organization>;
    getById(id: number): Promise<Organization | null>;
    getAll(options?: {
        search?: string;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    }): Promise<{
        organizations: Organization[];
        count: number;
    }>;
    update(id: number, data: UpdateOrganizationData): Promise<Organization | null>;
    searchByOrgName(query: string): Promise<Organization[] | null>;
    delete(id: number): Promise<boolean>;
    restore(id: number): Promise<Organization | null>;
}
//# sourceMappingURL=OrganizationService.d.ts.map