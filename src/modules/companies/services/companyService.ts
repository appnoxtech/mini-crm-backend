import { Company, CompanyModel } from '../models/company';

export class CompanyService {
    constructor(private companyModel: CompanyModel) { }

    async createCompany(data: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<Company> {
        return this.companyModel.create(data);
    }

    async getCompanyById(id: number): Promise<Company | null> {
        return this.companyModel.findById(id);
    }

    async getCompaniesByOwner(ownerUserId: number): Promise<Company[]> {
        return this.companyModel.findByOwnerId(ownerUserId);
    }

    async updateCompany(id: number, data: Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Company | null> {
        return this.companyModel.update(id, data);
    }

    async deleteCompany(id: number): Promise<boolean> {
        return this.companyModel.softDelete(id);
    }

}
