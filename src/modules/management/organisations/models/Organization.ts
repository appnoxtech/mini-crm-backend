import { prisma } from '../../../../shared/prisma';
import { BaseEntity } from '../../../../shared/types';
import { Prisma } from '@prisma/client';

export interface Organization extends BaseEntity {
    name: string;
    description?: string;
    industry?: string;
    website?: string;
    status?: 'active' | 'inactive';

    emails?: { value: string; type: string }[];
    phones?: { value: string; type: string }[];
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
    emails: any[];
    phones: any[];
    address: any;
    annualRevenue: number;
    numberOfEmployees: number;
    linkedinProfile: string;
}

export interface CreateOrganizationData {
    name: string;
    description?: string;
    website?: string;
    industry?: string;
    status?: string;
    emails?: { value: string; type: string }[];
    phones?: { value: string; type: string }[];
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
    emails?: { value: string; type: string }[];
    phones?: { value: string; type: string }[];
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

export class OrganizationModel {
    constructor() { }

    initialize(): void { }

    async create(data: CreateOrganizationData): Promise<Organization> {
        const org = await prisma.organization.create({
            data: {
                name: data.name,
                description: data.description || null,
                industry: data.industry || null,
                website: data.website || null,
                status: (data.status as any) || 'active',
                emails: (data.emails as any) || (Prisma as any).JsonNull,
                phones: (data.phones as any) || (Prisma as any).JsonNull,
                annualRevenue: data.annualRevenue || null,
                numberOfEmployees: data.numberOfEmployees || null,
                linkedinProfile: data.linkedinProfile || null,
                address: (data.address as any) || (Prisma as any).JsonNull
            }
        });

        return this.mapPrismaOrgToOrg(org);
    }

    async findByIds(ids: number[], includeDeleted = false): Promise<Organization[]> {
        if (ids.length === 0) return [];
        const rows = await prisma.organization.findMany({
            where: {
                id: { in: ids },
                ...(!includeDeleted && { deletedAt: null })
            }
        });
        return rows.map((r: any) => this.mapPrismaOrgToOrg(r));
    }

    async findById(id: number, includeDeleted = false): Promise<Organization | null> {
        const org = await prisma.organization.findUnique({
            where: { id }
        });
        if (!org || (!includeDeleted && org.deletedAt)) return null;
        return this.mapPrismaOrgToOrg(org);
    }

    async searchByOrgName(search: string): Promise<Organization[]> {
        const rows = await prisma.organization.findMany({
            where: {
                name: { contains: search, mode: 'insensitive' },
                deletedAt: null
            }
        });
        return rows.map((r: any) => this.mapPrismaOrgToOrg(r));
    }

    async searchByOrganizationName(search: string): Promise<searchOrgResult[]> {
        const rows = await prisma.organization.findMany({
            where: {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { industry: { contains: search, mode: 'insensitive' } },
                    { website: { contains: search, mode: 'insensitive' } }
                ],
                deletedAt: null
            }
        });

        return rows.map((org: any) => ({
            id: org.id,
            name: org.name,
            description: org.description || '',
            industry: org.industry || '',
            website: org.website || '',
            status: org.status || '',
            emails: (org.emails as any[]) || [],
            phones: (org.phones as any[]) || [],
            address: org.address,
            annualRevenue: org.annualRevenue || 0,
            numberOfEmployees: org.numberOfEmployees || 0,
            linkedinProfile: org.linkedinProfile || ''
        }));
    }

    async findAll(options: {
        search?: string;
        limit?: number;
        offset?: number;
        includeDeleted?: boolean;
    } = {}): Promise<{ organizations: Organization[]; count: number }> {
        const where: any = {};

        if (!options.includeDeleted) {
            where.deletedAt = null;
        }

        if (options.search) {
            where.OR = [
                { name: { contains: options.search, mode: 'insensitive' } },
                { description: { contains: options.search, mode: 'insensitive' } },
                { industry: { contains: options.search, mode: 'insensitive' } },
                { website: { contains: options.search, mode: 'insensitive' } }
            ];
        }

        const [rows, count] = await Promise.all([
            prisma.organization.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: options.limit,
                skip: options.offset || 0
            }),
            prisma.organization.count({ where })
        ]);

        return {
            organizations: rows.map((r: any) => this.mapPrismaOrgToOrg(r)),
            count
        };
    }

    async update(id: number, data: UpdateOrganizationData & any): Promise<Organization | null> {
        try {
            const updated = await prisma.organization.update({
                where: { id },
                data: {
                    ...(data.name !== undefined && { name: data.name }),
                    ...(data.description !== undefined && { description: data.description }),
                    ...(data.industry !== undefined && { industry: data.industry }),
                    ...(data.website !== undefined && { website: data.website }),
                    ...(data.status !== undefined && { status: data.status }),
                    ...(data.emails !== undefined && { emails: data.emails as any }),
                    ...(data.phones !== undefined && { phones: data.phones as any }),
                    ...(data.annualRevenue !== undefined && { annualRevenue: data.annualRevenue }),
                    ...(data.numberOfEmployees !== undefined && { numberOfEmployees: data.numberOfEmployees }),
                    ...(data.linkedinProfile !== undefined && { linkedinProfile: data.linkedinProfile }),
                    ...(data.address !== undefined && { address: data.address as any }),
                    updatedAt: new Date()
                }
            });
            return this.mapPrismaOrgToOrg(updated);
        } catch (error) {
            return null;
        }
    }

    async softDelete(id: number): Promise<boolean> {
        try {
            await prisma.organization.update({
                where: { id },
                data: { deletedAt: new Date() }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async restore(id: number): Promise<Organization | null> {
        try {
            const org = await prisma.organization.update({
                where: { id },
                data: { deletedAt: null }
            });
            return this.mapPrismaOrgToOrg(org);
        } catch (error) {
            return null;
        }
    }

    async hardDelete(id: number): Promise<boolean> {
        try {
            await prisma.organization.delete({
                where: { id }
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    private mapPrismaOrgToOrg(org: any): Organization {
        return {
            id: org.id,
            name: org.name,
            description: org.description || undefined,
            industry: org.industry || undefined,
            website: org.website || undefined,
            status: org.status as any,
            emails: (org.emails as any[]) || [],
            phones: (org.phones as any[]) || [],
            address: org.address || undefined,
            annualRevenue: org.annualRevenue || undefined,
            numberOfEmployees: org.numberOfEmployees || undefined,
            linkedinProfile: org.linkedinProfile || undefined,
            createdAt: org.createdAt.toISOString(),
            updatedAt: org.updatedAt.toISOString(),
            deletedAt: org.deletedAt?.toISOString() || undefined
        };
    }
}
