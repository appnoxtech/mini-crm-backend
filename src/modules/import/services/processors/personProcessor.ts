import { ImportError, PersonImportData, ProcessResult, DuplicateHandling } from '../../types';
import { PersonModel } from '../../../management/persons/models/Person';
import { OrganizationModel } from '../../../management/organisations/models/Organization';
import { EmailLabel, PhoneType } from '../../../management/persons/models/Person';

export class PersonProcessor {
    private personModel: PersonModel;
    private orgModel: OrganizationModel;

    constructor(_db?: any) {
        this.personModel = new PersonModel();
        this.orgModel = new OrganizationModel();
    }

    /**
     * Validate person data
     */
    validate(data: PersonImportData, rowNumber: number): ImportError[] {
        const errors: ImportError[] = [];

        // Required field validation
        if (!data.firstName?.trim()) {
            errors.push({
                row: rowNumber,
                column: 'firstName',
                errorType: 'validation',
                message: 'First name is required',
            });
        } else if (data.firstName.length > 100) {
            errors.push({
                row: rowNumber,
                column: 'firstName',
                value: data.firstName,
                errorType: 'validation',
                message: 'First name must be less than 100 characters',
            });
        }

        if (!data.lastName?.trim()) {
            errors.push({
                row: rowNumber,
                column: 'lastName',
                errorType: 'validation',
                message: 'Last name is required',
            });
        } else if (data.lastName.length > 100) {
            errors.push({
                row: rowNumber,
                column: 'lastName',
                value: data.lastName,
                errorType: 'validation',
                message: 'Last name must be less than 100 characters',
            });
        }

        // Email validation
        const emails = this.parseEmails(data);
        if (emails.length === 0) {
            errors.push({
                row: rowNumber,
                column: 'email',
                errorType: 'validation',
                message: 'At least one email is required',
            });
        } else {
            for (const emailObj of emails) {
                if (!this.isValidEmail(emailObj.email)) {
                    errors.push({
                        row: rowNumber,
                        column: 'email',
                        value: emailObj.email,
                        errorType: 'validation',
                        message: `Invalid email format: ${emailObj.email}`,
                    });
                }
            }
        }

        // Phone validation (optional but must be valid if provided)
        const phones = this.parsePhones(data);
        for (const phoneObj of phones) {
            if (!this.isValidPhone(phoneObj.number)) {
                errors.push({
                    row: rowNumber,
                    column: 'phone',
                    value: phoneObj.number,
                    errorType: 'validation',
                    message: `Invalid phone format: ${phoneObj.number}`,
                });
            }
        }

        // Country validation (optional)
        if (data.country && data.country.length > 100) {
            errors.push({
                row: rowNumber,
                column: 'country',
                value: data.country,
                errorType: 'validation',
                message: 'Country must be less than 100 characters',
            });
        }

        return errors;
    }

    /**
     * Check for duplicates
     */
    async checkDuplicate(data: PersonImportData): Promise<{ isDuplicate: boolean; existingId?: number; field?: string; value?: string }> {
        const emails = this.parseEmails(data);
        const emailStrings = emails.map(e => e.email);

        // Check email duplicates
        const existingEmail = await this.personModel.findExistingEmail(emailStrings);
        if (existingEmail) {
            return {
                isDuplicate: true,
                existingId: existingEmail.personId,
                field: 'email',
                value: existingEmail.email,
            };
        }

        // Check phone duplicates
        const phones = this.parsePhones(data);
        const phoneStrings = phones.map(p => p.number);
        if (phoneStrings.length > 0) {
            const existingPhone = await this.personModel.findExistingPhone(phoneStrings);
            if (existingPhone) {
                return {
                    isDuplicate: true,
                    existingId: existingPhone.personId,
                    field: 'phone',
                    value: existingPhone.phone,
                };
            }
        }

        return { isDuplicate: false };
    }

    /**
     * Process a single person record
     */
    async process(
        data: PersonImportData,
        userId: number,
        duplicateHandling: DuplicateHandling
    ): Promise<ProcessResult> {
        const emails = this.parseEmails(data);
        const phones = this.parsePhones(data);

        // Check for duplicates
        const duplicateCheck = await this.checkDuplicate(data);

        if (duplicateCheck.isDuplicate) {
            switch (duplicateHandling) {
                case 'skip':
                    return { status: 'skipped' };
                case 'update':
                    return this.updateExistingPerson(duplicateCheck.existingId!, data, emails, phones);
                case 'error':
                    throw new Error(`Duplicate ${duplicateCheck.field} found: ${duplicateCheck.value}`);
                case 'create':
                    // Fall through to create new (may fail due to unique constraints)
                    break;
            }
        }

        // Resolve organization if provided
        let organizationId: number | undefined;
        if (data.organizationName?.trim()) {
            organizationId = await this.resolveOrganization(data.organizationName.trim());
        }

        // Create new person
        const person = await this.personModel.create({
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            emails: emails as any,
            phones: phones as any,
            organizationId,
            country: data.country?.trim(),
        });

        return { status: 'created', id: person.id };
    }

    /**
     * Parse emails from import data
     */
    private parseEmails(data: PersonImportData): { email: string; label: string }[] {
        const emails: { email: string; label: string }[] = [];

        if (data.email?.trim()) {
            emails.push({ email: data.email.trim().toLowerCase(), label: 'work' as EmailLabel });
        }

        if (data.emails?.trim()) {
            const emailList = data.emails.split(/[,;]/).map(e => e.trim().toLowerCase()).filter(Boolean);
            emailList.forEach(email => {
                if (!emails.some(e => e.email === email)) {
                    emails.push({ email, label: 'work' as EmailLabel });
                }
            });
        }

        return emails;
    }

    /**
     * Parse phones from import data
     */
    private parsePhones(data: PersonImportData): { number: string; type: string }[] {
        const phones: { number: string; type: string }[] = [];

        if (data.phone?.trim()) {
            phones.push({ number: this.normalizePhone(data.phone), type: 'work' as PhoneType });
        }

        if (data.phones?.trim()) {
            const phoneList = data.phones.split(/[,;]/).map(p => p.trim()).filter(Boolean);
            phoneList.forEach(phone => {
                const normalized = this.normalizePhone(phone);
                if (!phones.some(p => p.number === normalized)) {
                    phones.push({ number: normalized, type: 'work' as PhoneType });
                }
            });
        }

        return phones;
    }

    /**
     * Normalize phone number
     */
    private normalizePhone(phone: string): string {
        // Remove all non-digit characters except + at the beginning
        return phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
    }

    /**
     * Resolve organization by name (create if doesn't exist)
     */
    private async resolveOrganization(name: string): Promise<number> {
        const existing = await this.orgModel.searchByOrgName(name);

        // Find exact match (case-insensitive)
        const exactMatch = existing.find(org => org.name.toLowerCase() === name.toLowerCase());
        if (exactMatch) {
            return exactMatch.id;
        }

        // Create new organization
        const org = await this.orgModel.create({ name });
        return org.id;
    }

    /**
     * Update existing person
     */
    private async updateExistingPerson(
        personId: number,
        data: PersonImportData,
        emails: { email: string; label: string }[],
        phones: { number: string; type: string }[]
    ): Promise<ProcessResult> {
        let organizationId: number | undefined;
        if (data.organizationName?.trim()) {
            organizationId = await this.resolveOrganization(data.organizationName.trim());
        }

        await this.personModel.update(personId, {
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            emails: emails as any,
            phones: phones as any,
            organizationId,
            country: data.country?.trim(),
        });

        return { status: 'updated', id: personId };
    }

    /**
     * Validate email format
     */
    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validate phone format
     */
    private isValidPhone(phone: string): boolean {
        // Allow digits, spaces, dashes, parentheses, and + at the beginning
        // Must have at least 7 digits
        const digits = phone.replace(/\D/g, '');
        return digits.length >= 7 && digits.length <= 20;
    }

    /**
     * Get field definitions for mapping suggestions
     */
    static getFieldDefinitions(): { name: string; type: string; required: boolean; aliases: string[] }[] {
        return [
            { name: 'firstName', type: 'string', required: true, aliases: ['first name', 'firstname', 'first', 'given name', 'forename'] },
            { name: 'lastName', type: 'string', required: true, aliases: ['last name', 'lastname', 'last', 'surname', 'family name'] },
            { name: 'email', type: 'string', required: true, aliases: ['email', 'e-mail', 'email address', 'mail', 'primary email'] },
            { name: 'emails', type: 'string', required: false, aliases: ['emails', 'all emails', 'other emails'] },
            { name: 'phone', type: 'string', required: false, aliases: ['phone', 'telephone', 'mobile', 'cell', 'phone number', 'primary phone'] },
            { name: 'phones', type: 'string', required: false, aliases: ['phones', 'all phones', 'other phones'] },
            { name: 'organizationName', type: 'string', required: false, aliases: ['organization', 'organisation', 'company', 'company name', 'org', 'employer'] },
            { name: 'country', type: 'string', required: false, aliases: ['country', 'nation', 'country name'] },
        ];
    }

    /**
     * Delete person
     */
    async delete(id: number): Promise<boolean> {
        return this.personModel.hardDelete(id);
    }
}
