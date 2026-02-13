import { Response } from 'express';
import { CompanyService } from '../services/companyService';
import { AuthenticatedRequest } from '../../../shared/types';
import { ResponseHandler } from '../../../shared/responses/responses';

export class CompanyController {
    constructor(private companyService: CompanyService) { }

    async createCompany(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }

            const {
                name,
                companyDomain,
                companyLogo,
                companyDescription,
                industry,
                companySize,
                companyLocation,
                companyWebsite,
                companySocialLinks,
                pricingTierId,
                timezone,
                locale
            } = req.body;

            const company = await this.companyService.createCompany({
                name,
                companyDomain,
                companyLogo,
                companyDescription,
                industry,
                companySize,
                companyLocation,
                companyWebsite,
                companySocialLinks,
                isActive: true,
                ownerUserId: req.user.id,
                createdByUserId: req.user.id,
                pricingTierId: pricingTierId || 1, // Default tier
                billingStatus: 'TRIAL',
                timezone: timezone || 'UTC',
                locale: locale || 'en'
            });

            return ResponseHandler.created(res, company, 'Company created successfully');
        } catch (error: any) {
            console.error('Error creating company:', error);
            if (error.code === 'P2002') {
                return ResponseHandler.validationError(res, { companyDomain: 'Company domain already exists' });
            }
            return ResponseHandler.internalError(res, error.message || 'Failed to create company');
        }
    }

    async getMyCompanies(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user || !req.user.id || req.user.role !== 'admin') {
                return ResponseHandler.unauthorized(res, 'User not authenticated');
            }


            const companies = await this.companyService.getCompaniesByOwner(req.user!.id);

            if (!companies) {
                return ResponseHandler.notFound(res, 'Companies not found');
            }

            return ResponseHandler.success(res, { companies }, 'Companies fetched successfully');
        } catch (error: any) {
            console.error('Error fetching companies:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch companies');
        }
    }

    async getCompanyById(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const company = await this.companyService.getCompanyById(Number(id));

            if (!company) {
                return ResponseHandler.notFound(res, 'Company not found');
            }
            if (company.ownerUserId !== req.user!.id || company.createdByUserId !== req.user!.id) {
                return ResponseHandler.unauthorized(res, 'User not authorized to access this company');
            }

            // Optional: Check if user has access to this company
            // if (company.ownerUserId !== req.user?.id) { ... }

            return ResponseHandler.success(res, company, 'Company fetched successfully');
        } catch (error: any) {
            console.error('Error fetching company:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch company');
        }
    }

    async updateCompany(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const updateData = req.body;

            const company = await this.companyService.updateCompany(Number(id), updateData);

            if (!company) {
                return ResponseHandler.notFound(res, 'Company not found');
            }
            if (company.ownerUserId !== req.user!.id || company.createdByUserId !== req.user!.id) {
                return ResponseHandler.unauthorized(res, 'User not authorized to access this company');
            }

            return ResponseHandler.success(res, company, 'Company updated successfully');
        } catch (error: any) {
            console.error('Error updating company:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to update company');
        }
    }

    async deleteCompany(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const company = await this.companyService.getCompanyById(Number(id));
            if (!company) {
                return ResponseHandler.notFound(res, 'Company not found');
            }
            if (company.ownerUserId !== req.user!.id || company.createdByUserId !== req.user!.id) {
                return ResponseHandler.unauthorized(res, 'User not authorized to access this company');
            }
            const result = await this.companyService.deleteCompany(Number(id));

            if (!result) {
                return ResponseHandler.notFound(res, 'Company not found');
            }

            return ResponseHandler.success(res, { success: true }, 'Company deleted successfully');
        } catch (error: any) {
            console.error('Error deleting company:', error);
            return ResponseHandler.internalError(res, error.message || 'Failed to delete company');
        }
    }


    // invite user to company
    // async inviteUser(req: AuthenticatedRequest, res: Response): Promise<void> {
    //     try {
    //         if (!req.user) {
    //             return ResponseHandler.unauthorized(res, 'User not authenticated');
    //         }

    //         // array of emails
    //         const { emails } = req.body;

    //         // invite user to company it's template and send mail throrough email service

    //         const invitation = await this.companyService.inviteUser(req.user, emails);

    //         return ResponseHandler.success(res, invitation, 'Invitation sent successfully');


    //     } catch (error: any) {
    //         console.error('Error updating company:', error);
    //         return ResponseHandler.internalError(res, error.message || 'Failed to update company');
    //     }
    // }

}
