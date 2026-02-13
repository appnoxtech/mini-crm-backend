import { ImportError, PersonImportData, ProcessResult, DuplicateHandling } from '../../types';
import { PersonModel, PersonEmail, PersonPhone, EmailLabel, PhoneType } from '../../../management/persons/models/Person';
import { OrganizationModel } from '../../../management/organisations/models/Organization';


export class PersonProcessor {
    private personModel: PersonModel;
    private orgModel: OrganizationModel;

    constructor(_db?: any) {
        this.personModel = new PersonModel();
        this.orgModel = new OrganizationModel();
    }

    // ... skipping validate ... (I will target chunks to avoid replacing whole file)

    /**
     * Validate person data
     */
    validate(data: PersonImportData, rowNumber: number): ImportError[] {
        const errors: ImportError[] = [];

        try {
            // Parse name fields using the same logic as processing
            const { firstName, lastName } = this.parseNameFields(data);

            // Required field validation
            if (!firstName?.trim()) {
                errors.push({
                    row: rowNumber,
                    column: 'firstName',
                    errorType: 'validation',
                    message: 'First name is required',
                });
            } else if (firstName.length > 100) {
                errors.push({
                    row: rowNumber,
                    column: 'firstName',
                    value: firstName,
                    errorType: 'validation',
                    message: 'First name must be less than 100 characters',
                });
            }

            // Last name validation (optional but must be valid if provided)
            if (lastName && lastName.length > 100) {
                errors.push({
                    row: rowNumber,
                    column: 'lastName',
                    value: lastName,
                    errorType: 'validation',
                    message: 'Last name must be less than 100 characters',
                });
            }

            // Email validation (optional but must be valid if provided)
            const emails = this.parseEmails(data);
            if (emails.length > 0) {
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

        } catch (error) {
            errors.push({
                row: rowNumber,
                errorType: 'system',
                message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            });
        }

        return errors;
    }

    /**
     * Check for duplicates
     */
    /**
     * Check for duplicates
     */
    async checkDuplicate(data: PersonImportData, companyId: number): Promise<{ isDuplicate: boolean; existingId?: number; field?: string; value?: string }> {
        try {
            const emails = this.parseEmails(data);
            const emailStrings = emails.map(e => e.email);

            // Check email duplicates
            if (emailStrings.length > 0) {
                const existingEmail = await this.personModel.findExistingEmail(emailStrings, companyId);
                if (existingEmail) {
                    return {
                        isDuplicate: true,
                        existingId: existingEmail.personId,
                        field: 'email',
                        value: existingEmail.email,
                    };
                }
            }

            // Check phone duplicates
            const phones = this.parsePhones(data);
            const phoneStrings = phones.map(p => p.number);
            if (phoneStrings.length > 0) {
                const existingPhone = await this.personModel.findExistingPhone(phoneStrings, companyId);
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
        } catch (error) {
            console.error('Error checking duplicates:', error);
            return { isDuplicate: false };
        }
    }

    /**
     * Process a single person record
     */
    async process(
        data: PersonImportData,
        userId: number,
        companyId: number,
        duplicateHandling: DuplicateHandling
    ): Promise<ProcessResult> {
        try {
            const emails = this.parseEmails(data);
            const phones = this.parsePhones(data);

            // Parse name fields (handle Pipedrive "Name" field that contains full name)
            const { firstName, lastName } = this.parseNameFields(data);

            // Check for duplicates
            const duplicateCheck = await this.checkDuplicate(data, companyId);

            if (duplicateCheck.isDuplicate) {
                switch (duplicateHandling) {
                    case 'skip':
                        return { status: 'skipped' };
                    case 'update':
                        return this.updateExistingPerson(duplicateCheck.existingId!, companyId, data, emails, phones, firstName, lastName);
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
                try {
                    organizationId = await this.resolveOrganization(data.organizationName.trim(), companyId);
                } catch (error) {
                    console.error('Error resolving organization:', error);
                    // Continue without organization
                }
            }

            // Create new person
            const person = await this.personModel.create({
                firstName: firstName.trim(),
                lastName: lastName?.trim() || '',
                emails,
                phones,
                companyId,
                organizationId,
            });

            return { status: 'created', id: person.id };
        } catch (error) {
            throw new Error(`Failed to process person: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Parse name fields from import data - handles Pipedrive CSV format
     * Pipedrive has "Name" (full name), "First name", and "Last name" columns
     */
    private parseNameFields(data: PersonImportData): { firstName: string; lastName: string } {
        const rawData = data as any;

        // Priority 1: Use "First name" and "Last name" if available (Pipedrive format)
        if (rawData['First name']?.trim()) {
            return {
                firstName: rawData['First name'].trim(),
                lastName: rawData['Last name']?.trim() || ''
            };
        }

        // Priority 2: Use standard firstName/lastName fields
        if (data.firstName?.trim()) {
            return {
                firstName: data.firstName.trim(),
                lastName: data.lastName?.trim() || ''
            };
        }

        // Priority 3: Parse "Name" field (full name) - split into first and last
        if (rawData['Name']?.trim()) {
            const fullName = rawData['Name'].trim();
            const nameParts = fullName.split(/\s+/);

            if (nameParts.length === 1) {
                return { firstName: nameParts[0], lastName: '' };
            } else {
                // First part is first name, rest is last name
                return {
                    firstName: nameParts[0],
                    lastName: nameParts.slice(1).join(' ')
                };
            }
        }

        // Priority 4: Fallback to Email if available
        // Try mapped email field first, then common Pipedrive email columns
        const email = data.email?.trim() ||
            rawData['Email - Work']?.trim() ||
            rawData['Email']?.trim() ||
            rawData['e-mail']?.trim();

        if (email) {
            // Use the part before @ as the first name, or the whole email
            const nameFromEmail = email.split('@')[0] || email;
            return { firstName: nameFromEmail, lastName: '' };
        }

        // Fallback: return empty strings (will fail validation)
        return { firstName: '', lastName: '' };
    }

    /**
     * Parse emails from import data - handles Pipedrive CSV format
     */
    private parseEmails(data: PersonImportData): PersonEmail[] {
        const emails: PersonEmail[] = [];
        const seenEmails = new Set<string>();

        // Helper function to add email if valid and unique
        const addEmail = (emailStr: string | undefined, label: EmailLabel) => {
            if (!emailStr) return;

            // Split by comma or semicolon for multiple emails
            const emailList = emailStr.split(/[,;]/).map(e => e.trim()).filter(e => e.length > 0);

            for (const email of emailList) {
                const normalized = email.toLowerCase();
                if (this.isValidEmail(normalized) && !seenEmails.has(normalized)) {
                    emails.push({ email: normalized, label });
                    seenEmails.add(normalized);
                }
            }
        };

        // Parse standard email field
        if (data.email?.trim()) {
            addEmail(data.email, 'work');
        }

        // Parse emails field (comma-separated)
        if (data.emails?.trim()) {
            addEmail(data.emails, 'work');
        }

        // Parse Pipedrive-style email fields
        const rawData = data as any;
        addEmail(rawData['Email - Work'], 'work');
        addEmail(rawData['Email - Home'], 'home');
        addEmail(rawData['Email - Other'], 'other');

        return emails;
    }

    /**
     * Parse phones from import data - handles Pipedrive CSV format
     */
    private parsePhones(data: PersonImportData): PersonPhone[] {
        const phones: PersonPhone[] = [];
        const seenPhones = new Set<string>();

        // Helper function to add phone if valid and unique
        const addPhone = (phoneStr: string | undefined, type: PhoneType) => {
            if (!phoneStr) return;

            // Split by comma or semicolon for multiple phones
            const phoneList = phoneStr.split(/[,;]/).map(p => p.trim()).filter(p => p.length > 0);

            for (const phone of phoneList) {
                const normalized = this.normalizePhone(phone);
                if (this.isValidPhone(normalized) && !seenPhones.has(normalized)) {
                    phones.push({ number: normalized, type });
                    seenPhones.add(normalized);
                }
            }
        };

        // Parse standard phone field
        if (data.phone?.trim()) {
            addPhone(data.phone, 'work');
        }

        // Parse phones field (comma-separated)
        if (data.phones?.trim()) {
            addPhone(data.phones, 'work');
        }

        // Parse Pipedrive-style phone fields
        const rawData = data as any;
        addPhone(rawData['Phone - Work'], 'work');
        addPhone(rawData['Phone - Home'], 'home');
        addPhone(rawData['Phone - Mobile'], 'mobile');
        addPhone(rawData['Phone - Other'], 'other');

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
    private async resolveOrganization(name: string, companyId: number): Promise<number> {
        const existing = await this.orgModel.searchByOrgName(name, companyId);

        // Find exact match (case-insensitive)
        const exactMatch = existing.find(org => org.name.toLowerCase() === name.toLowerCase());
        if (exactMatch) {
            return exactMatch.id;
        }

        // Create new organization
        const org = await this.orgModel.create({ name, companyId });
        return org.id;
    }

    /**
     * Update existing person
     */
    private async updateExistingPerson(
        personId: number,
        companyId: number,
        data: PersonImportData,
        emails: PersonEmail[],
        phones: PersonPhone[],
        firstName: string,
        lastName: string
    ): Promise<ProcessResult> {
        let organizationId: number | undefined;
        if (data.organizationName?.trim()) {
            organizationId = await this.resolveOrganization(data.organizationName.trim(), companyId);
        }

        await this.personModel.update(personId, companyId, {
            firstName: firstName.trim(),
            lastName: lastName?.trim() || '',
            emails,
            phones,
            organizationId,
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
            {
                name: 'firstName',
                type: 'string',
                required: true,
                aliases: ['first name', 'firstname', 'first', 'given name', 'forename', 'First name']
            },
            {
                name: 'lastName',
                type: 'string',
                required: false,  // Optional - many contacts have only first name
                aliases: ['last name', 'lastname', 'last', 'surname', 'family name', 'Last name']
            },
            {
                name: 'name',
                type: 'string',
                required: false,
                aliases: ['Name', 'name', 'full name', 'fullname', 'Full Name']
            },
            {
                name: 'email',
                type: 'string',
                required: false,  // Changed to optional - contacts may have only phone numbers
                aliases: ['email', 'e-mail', 'email address', 'mail', 'primary email', 'Email - Work', 'Email - Home', 'Email - Other']
            },
            {
                name: 'emails',
                type: 'string',
                required: false,
                aliases: ['emails', 'all emails', 'other emails']
            },
            {
                name: 'phone',
                type: 'string',
                required: false,
                aliases: ['phone', 'telephone', 'mobile', 'cell', 'phone number', 'primary phone', 'Phone - Work', 'Phone - Home', 'Phone - Mobile', 'Phone - Other']
            },
            {
                name: 'phones',
                type: 'string',
                required: false,
                aliases: ['phones', 'all phones', 'other phones']
            },
            {
                name: 'organizationName',
                type: 'string',
                required: false,
                aliases: ['organization', 'organisation', 'company', 'company name', 'org', 'employer', 'Organization']
            },
        ];
    }

    /**
     * Delete person
     */
    async delete(id: number, companyId: number): Promise<boolean> {
        return this.personModel.hardDelete(id, companyId);
    }
}
