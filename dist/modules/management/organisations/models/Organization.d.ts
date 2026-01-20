import Database from 'better-sqlite3';
import { BaseEntity } from '../../../../shared/types';
export interface Organization extends BaseEntity {
    name: string;
    description?: string;
    industry?: string;
    website?: string;
    status?: 'active' | 'inactive';
    emails?: {
        value: string;
        type: string;
    }[];
    phones?: {
        value: string;
        type: string;
    }[];
    annualRevenue?: number;
    numberOfEmployees?: number;
    linkedinProfile?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        pincode?: string;
    };
    deletedAt?: string;
}
export type searchOrgResult = {
    id: number;
    name: string;
    description: string;
    industry: string;
    website: string;
    status: string;
    emails: string;
    phones: string;
    address: string;
    annualRevenue: number;
    numberOfEmployees: number;
    linkedinProfile: string;
};
export interface CreateOrganizationData {
    name: string;
    description?: string;
    website?: string;
    industry?: string;
    status?: string;
    emails?: {
        value: string;
        type: string;
    }[];
    phones?: {
        value: string;
        type: string;
    }[];
    annualRevenue?: number;
    numberOfEmployees?: number;
    linkedinProfile?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        pincode?: string;
    };
}
export interface UpdateOrganizationData {
    name?: string;
    description?: string;
    website?: string;
    industry?: string;
    status?: string;
    emails?: {
        value: string;
        type: string;
    }[];
    phones?: {
        value: string;
        type: string;
    }[];
    annualRevenue?: number;
    numberOfEmployees?: number;
    linkedinProfile?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        pincode?: string;
    };
}
export declare class OrganizationModel {
    private db;
    constructor(db: Database.Database);
    initialize(): void;
    create(data: CreateOrganizationData): Organization;
    findById(id: number, includeDeleted?: boolean): Organization | undefined;
    searchByOrgName(search: string): Organization[];
    searchByOrganizationName(search: string): searchOrgResult[];
    findAll(options?: {
        search?: string;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    }): {
        organizations: Organization[];
        count: number;
    };
    update(id: number, data: UpdateOrganizationData & any): Organization | null;
    softDelete(id: number): boolean;
    restore(id: number): Organization | null;
    hardDelete(id: number): boolean;
}
//# sourceMappingURL=Organization.d.ts.map