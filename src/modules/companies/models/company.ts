import { prisma } from '../../../shared/prisma';
import { BaseEntity } from '../../../shared/types';
import { Prisma } from '@prisma/client';

export interface Company extends BaseEntity {
    name: string;
    companyDomain: string;
    companyLogo?: string;
    companyDescription?: string;
    industry?: string;
    companySize?: string;
    companyLocation?: string;
    companyWebsite?: string;
    companySocialLinks?: any;
    isActive: boolean;
    deletedAt?: string;
    archivedAt?: string;
    ownerUserId?: number;
    createdByUserId?: number;
    pricingTierId?: number;
    billingStatus: string;
    trialEndsAt?: string;
    settings?: any;
    timezone: string;
    locale: string;
}

export class CompanyModel {
    constructor() { }

    async create(data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company> {
        const company = await prisma.company.create({
            data: {
                name: data.name,
                companyDomain: data.companyDomain || null,
                companyLogo: data.companyLogo || null,
                companyDescription: data.companyDescription || null,
                industry: data.industry || null,
                companySize: data.companySize || null,
                companyLocation: data.companyLocation || null,
                companyWebsite: data.companyWebsite || null,
                companySocialLinks: data.companySocialLinks || (Prisma as any).JsonNull,

                isActive: data.isActive ?? true,
                ownerUserId: data.ownerUserId ?? undefined,
                createdByUserId: data.createdByUserId ?? undefined,

                pricingTierId: data.pricingTierId ?? undefined,
                billingStatus: data.billingStatus || 'TRIAL',

                trialEndsAt: data.trialEndsAt ? new Date(data.trialEndsAt) : null,
                settings: data.settings || (Prisma as any).JsonNull,
                timezone: data.timezone || 'UTC',
                locale: data.locale || 'en'
            } as any
        });

        return this.mapPrismaCompanyToCompany(company);
    }

    async findById(id: number): Promise<Company | null> {
        if (!id) return null;
        const company = await prisma.company.findUnique({
            where: { id: id }
        });
        if (!company) return null;
        return this.mapPrismaCompanyToCompany(company);
    }

    async findByOwnerId(ownerUserId: number): Promise<Company[]> {
        const companies = await prisma.company.findMany({
            where: { ownerUserId, deletedAt: null }
        });
        return companies.map(c => this.mapPrismaCompanyToCompany(c));
    }

    async update(id: number, data: Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Company | null> {
        if (!id) return null;
        try {
            const updateData: any = {};
            if (data.name !== undefined) updateData.name = data.name;
            if (data.companyDomain !== undefined) updateData.companyDomain = data.companyDomain;
            if (data.companyLogo !== undefined) updateData.companyLogo = data.companyLogo;
            if (data.companyDescription !== undefined) updateData.companyDescription = data.companyDescription;
            if (data.industry !== undefined) updateData.industry = data.industry;
            if (data.companySize !== undefined) updateData.companySize = data.companySize;
            if (data.companyLocation !== undefined) updateData.companyLocation = data.companyLocation;
            if (data.companyWebsite !== undefined) updateData.companyWebsite = data.companyWebsite;
            if (data.companySocialLinks !== undefined) updateData.companySocialLinks = data.companySocialLinks;
            if (data.isActive !== undefined) updateData.isActive = data.isActive;

            if (data.ownerUserId !== undefined) updateData.ownerUserId = data.ownerUserId;
            if (data.createdByUserId !== undefined) updateData.createdByUserId = data.createdByUserId;
            if (data.pricingTierId !== undefined) updateData.pricingTierId = data.pricingTierId;
            if (data.billingStatus !== undefined) updateData.billingStatus = data.billingStatus;
            if (data.trialEndsAt !== undefined) updateData.trialEndsAt = data.trialEndsAt ? new Date(data.trialEndsAt) : null;
            if (data.settings !== undefined) updateData.settings = data.settings;
            if (data.timezone !== undefined) updateData.timezone = data.timezone;
            if (data.locale !== undefined) updateData.locale = data.locale;

            const company = await prisma.company.update({
                where: { id },
                data: updateData
            });

            return this.mapPrismaCompanyToCompany(company);
        } catch (error: any) {
            if (error.code === 'P2025') return null;
            throw error;
        }
    }

    async softDelete(id: number): Promise<boolean> {
        if (!id) return false;
        try {
            await prisma.company.update({
                where: { id },
                data: {
                    deletedAt: new Date(),
                    isActive: false
                }
            });
            return true;
        } catch (error: any) {
            if (error.code === 'P2025') return false;
            throw error;
        }
    }

    async delete(id: number): Promise<boolean> {
        if (!id) return false;
        try {
            await prisma.company.delete({
                where: { id }
            });
            return true;
        } catch (error: any) {
            if (error.code === 'P2025') return false;
            throw error;
        }
    }

    private mapPrismaCompanyToCompany(company: any): Company {
        return {
            id: company.id,
            name: company.name,
            companyDomain: company.companyDomain,
            companyLogo: company.companyLogo || undefined,
            companyDescription: company.companyDescription || undefined,
            industry: company.industry || undefined,
            companySize: company.companySize || undefined,
            companyLocation: company.companyLocation || undefined,
            companyWebsite: company.companyWebsite || undefined,
            companySocialLinks: company.companySocialLinks || undefined,
            isActive: company.isActive,
            deletedAt: company.deletedAt?.toISOString(),
            ownerUserId: company.ownerUserId || undefined,
            createdByUserId: company.createdByUserId || undefined,
            pricingTierId: company.pricingTierId || undefined,
            billingStatus: company.billingStatus,
            trialEndsAt: company.trialEndsAt?.toISOString(),
            settings: company.settings || undefined,
            timezone: company.timezone,
            locale: company.locale,
            createdAt: company.createdAt.toISOString(),
            updatedAt: company.updatedAt.toISOString()
        };
    }
}
