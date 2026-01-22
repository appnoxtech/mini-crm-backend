import Database from 'better-sqlite3';
import { ImportError, OrganizationImportData, ProcessResult, DuplicateHandling } from '../../types';
import { OrganizationModel } from '../../../management/organisations/models/Organization';

export class OrganizationProcessor {
    private db: Database.Database;
    private orgModel: OrganizationModel;

    constructor(db: Database.Database) {
        this.db = db;
        this.orgModel = new OrganizationModel(db);
    }

    /**
     * Validate organization data
     */
    validate(data: OrganizationImportData, rowNumber: number): ImportError[] {
        const errors: ImportError[] = [];

        // Required field validation
        if (!data.name?.trim()) {
            errors.push({
                row: rowNumber,
                column: 'name',
                errorType: 'validation',
                message: 'Organization name is required',
            });
        } else if (data.name.length > 200) {
            errors.push({
                row: rowNumber,
                column: 'name',
                value: data.name,
                errorType: 'validation',
                message: 'Organization name must be less than 200 characters',
            });
        }

        // Website validation
        if (data.website?.trim() && !this.isValidUrl(data.website)) {
            errors.push({
                row: rowNumber,
                column: 'website',
                value: data.website,
                errorType: 'validation',
                message: 'Invalid website URL format',
            });
        }

        // Email validation
        const emails = this.parseEmails(data);
        for (const emailObj of emails) {
            if (!this.isValidEmail(emailObj.value)) {
                errors.push({
                    row: rowNumber,
                    column: 'email',
                    value: emailObj.value,
                    errorType: 'validation',
                    message: `Invalid email format: ${emailObj.value}`,
                });
            }
        }

        // Numeric field validation
        if (data.annualRevenue !== undefined && data.annualRevenue !== null) {
            const revenue = Number(data.annualRevenue);
            if (isNaN(revenue) || revenue < 0) {
                errors.push({
                    row: rowNumber,
                    column: 'annualRevenue',
                    value: data.annualRevenue,
                    errorType: 'validation',
                    message: 'Annual revenue must be a positive number',
                });
            }
        }

        if (data.numberOfEmployees !== undefined && data.numberOfEmployees !== null) {
            const employees = Number(data.numberOfEmployees);
            if (isNaN(employees) || employees < 0 || !Number.isInteger(employees)) {
                errors.push({
                    row: rowNumber,
                    column: 'numberOfEmployees',
                    value: data.numberOfEmployees,
                    errorType: 'validation',
                    message: 'Number of employees must be a positive integer',
                });
            }
        }

        // LinkedIn profile validation
        if (data.linkedinProfile?.trim() && !this.isValidLinkedInUrl(data.linkedinProfile)) {
            errors.push({
                row: rowNumber,
                column: 'linkedinProfile',
                value: data.linkedinProfile,
                errorType: 'validation',
                message: 'Invalid LinkedIn profile URL',
            });
        }

        return errors;
    }

    /**
     * Check for duplicates by name
     */
    checkDuplicate(data: OrganizationImportData): { isDuplicate: boolean; existingId?: number } {
        if (!data.name?.trim()) return { isDuplicate: false };

        const existing = this.orgModel.searchByOrgName(data.name.trim());
        const exactMatch = existing.find(org => org.name.toLowerCase() === data.name.trim().toLowerCase());

        if (exactMatch) {
            return {
                isDuplicate: true,
                existingId: exactMatch.id,
            };
        }

        return { isDuplicate: false };
    }

    /**
     * Process a single organization record
     */
    process(
        data: OrganizationImportData,
        userId: number,
        duplicateHandling: DuplicateHandling
    ): ProcessResult {
        // Check for duplicates
        const duplicateCheck = this.checkDuplicate(data);

        if (duplicateCheck.isDuplicate) {
            switch (duplicateHandling) {
                case 'skip':
                    return { status: 'skipped' };
                case 'update':
                    return this.updateExistingOrganization(duplicateCheck.existingId!, data);
                case 'error':
                    throw new Error(`Duplicate organization name found: ${data.name}`);
                case 'create':
                    // Fall through to create new
                    break;
            }
        }

        // Prepare organization data
        const orgData = this.prepareOrganizationData(data);

        // Create new organization
        const org = this.orgModel.create(orgData);

        return { status: 'created', id: org.id };
    }

    /**
     * Prepare organization data from import data
     */
    private prepareOrganizationData(data: OrganizationImportData): any {
        const emails = this.parseEmails(data);
        const phones = this.parsePhones(data);
        const address = this.parseAddress(data);

        return {
            name: data.name.trim(),
            description: data.description?.trim() || undefined,
            industry: data.industry?.trim() || undefined,
            website: data.website?.trim() || undefined,
            emails: emails.length > 0 ? emails : undefined,
            phones: phones.length > 0 ? phones : undefined,
            address: Object.keys(address).length > 0 ? address : undefined,
            annualRevenue: data.annualRevenue ? Number(data.annualRevenue) : undefined,
            numberOfEmployees: data.numberOfEmployees ? Number(data.numberOfEmployees) : undefined,
            linkedinProfile: data.linkedinProfile?.trim() || undefined,
        };
    }

    /**
     * Update existing organization
     */
    private updateExistingOrganization(
        orgId: number,
        data: OrganizationImportData
    ): ProcessResult {
        const updateData = this.prepareOrganizationData(data);
        this.orgModel.update(orgId, updateData);
        return { status: 'updated', id: orgId };
    }

    /**
     * Parse emails from import data
     */
    private parseEmails(data: OrganizationImportData): { value: string; type: string }[] {
        const emails: { value: string; type: string }[] = [];

        if (data.email?.trim()) {
            emails.push({ value: data.email.trim().toLowerCase(), type: 'work' });
        }

        if (data.emails?.trim()) {
            const emailList = data.emails.split(/[,;]/).map(e => e.trim().toLowerCase()).filter(Boolean);
            emailList.forEach(email => {
                if (!emails.some(e => e.value === email)) {
                    emails.push({ value: email, type: 'work' });
                }
            });
        }

        return emails;
    }

    /**
     * Parse phones from import data
     */
    private parsePhones(data: OrganizationImportData): { value: string; type: string }[] {
        const phones: { value: string; type: string }[] = [];

        if (data.phone?.trim()) {
            phones.push({ value: this.normalizePhone(data.phone), type: 'work' });
        }

        if (data.phones?.trim()) {
            const phoneList = data.phones.split(/[,;]/).map(p => p.trim()).filter(Boolean);
            phoneList.forEach(phone => {
                const normalized = this.normalizePhone(phone);
                if (!phones.some(p => p.value === normalized)) {
                    phones.push({ value: normalized, type: 'work' });
                }
            });
        }

        return phones;
    }

    /**
     * Parse address from import data
     */
    private parseAddress(data: OrganizationImportData): any {
        const address: any = {};

        if (data.street?.trim()) address.street = data.street.trim();
        if (data.city?.trim()) address.city = data.city.trim();
        if (data.state?.trim()) address.state = data.state.trim();
        if (data.country?.trim()) address.country = data.country.trim();
        if (data.pincode?.trim()) address.pincode = data.pincode.trim();

        return address;
    }

    /**
     * Normalize phone number
     */
    private normalizePhone(phone: string): string {
        return phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
    }

    /**
     * Validate email format
     */
    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate URL format
     */
    private isValidUrl(url: string): boolean {
        try {
            const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
            return ['http:', 'https:'].includes(parsed.protocol);
        } catch {
            return false;
        }
    }

    /**
     * Validate LinkedIn URL
     */
    private isValidLinkedInUrl(url: string): boolean {
        if (!url.includes('linkedin.com')) return false;
        return this.isValidUrl(url);
    }

    /**
     * Get field definitions for mapping suggestions
     */
    static getFieldDefinitions(): { name: string; type: string; required: boolean; aliases: string[] }[] {
        return [
            { name: 'name', type: 'string', required: true, aliases: ['name', 'organization name', 'organisation name', 'company', 'company name', 'org name'] },
            { name: 'description', type: 'string', required: false, aliases: ['description', 'desc', 'about', 'summary'] },
            { name: 'industry', type: 'string', required: false, aliases: ['industry', 'sector', 'business type'] },
            { name: 'website', type: 'string', required: false, aliases: ['website', 'web', 'url', 'homepage', 'site'] },
            { name: 'email', type: 'string', required: false, aliases: ['email', 'e-mail', 'contact email', 'primary email'] },
            { name: 'emails', type: 'string', required: false, aliases: ['emails', 'all emails', 'other emails'] },
            { name: 'phone', type: 'string', required: false, aliases: ['phone', 'telephone', 'contact phone', 'primary phone'] },
            { name: 'phones', type: 'string', required: false, aliases: ['phones', 'all phones', 'other phones'] },
            { name: 'street', type: 'string', required: false, aliases: ['street', 'address', 'street address', 'address line 1'] },
            { name: 'city', type: 'string', required: false, aliases: ['city', 'town'] },
            { name: 'state', type: 'string', required: false, aliases: ['state', 'province', 'region'] },
            { name: 'country', type: 'string', required: false, aliases: ['country', 'nation'] },
            { name: 'pincode', type: 'string', required: false, aliases: ['pincode', 'zip', 'zip code', 'postal code', 'postcode'] },
            { name: 'annualRevenue', type: 'number', required: false, aliases: ['annual revenue', 'revenue', 'yearly revenue'] },
            { name: 'numberOfEmployees', type: 'number', required: false, aliases: ['number of employees', 'employees', 'employee count', 'size', 'headcount'] },
            { name: 'linkedinProfile', type: 'string', required: false, aliases: ['linkedin', 'linkedin profile', 'linkedin url'] },
        ];
    }

    /**
     * Delete organization
     */
    delete(id: number): boolean {
        return this.orgModel.hardDelete(id);
    }
}
