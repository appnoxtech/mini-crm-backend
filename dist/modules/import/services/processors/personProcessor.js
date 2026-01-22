"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonProcessor = void 0;
const Person_1 = require("../../../management/persons/models/Person");
const Organization_1 = require("../../../management/organisations/models/Organization");
class PersonProcessor {
    db;
    personModel;
    orgModel;
    constructor(db) {
        this.db = db;
        this.personModel = new Person_1.PersonModel(db);
        this.orgModel = new Organization_1.OrganizationModel(db);
    }
    /**
     * Validate person data
     */
    validate(data, rowNumber) {
        const errors = [];
        // Required field validation
        if (!data.firstName?.trim()) {
            errors.push({
                row: rowNumber,
                column: 'firstName',
                errorType: 'validation',
                message: 'First name is required',
            });
        }
        else if (data.firstName.length > 100) {
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
        }
        else if (data.lastName.length > 100) {
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
        }
        else {
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
    checkDuplicate(data) {
        const emails = this.parseEmails(data);
        const emailStrings = emails.map(e => e.email);
        // Check email duplicates
        const existingEmail = this.personModel.findExistingEmail(emailStrings);
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
            const existingPhone = this.personModel.findExistingPhone(phoneStrings);
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
    process(data, userId, duplicateHandling) {
        const emails = this.parseEmails(data);
        const phones = this.parsePhones(data);
        // Check for duplicates
        const duplicateCheck = this.checkDuplicate(data);
        if (duplicateCheck.isDuplicate) {
            switch (duplicateHandling) {
                case 'skip':
                    return { status: 'skipped' };
                case 'update':
                    return this.updateExistingPerson(duplicateCheck.existingId, data, emails, phones);
                case 'error':
                    throw new Error(`Duplicate ${duplicateCheck.field} found: ${duplicateCheck.value}`);
                case 'create':
                    // Fall through to create new (may fail due to unique constraints)
                    break;
            }
        }
        // Resolve organization if provided
        let organizationId;
        if (data.organizationName?.trim()) {
            organizationId = this.resolveOrganization(data.organizationName.trim());
        }
        // Create new person
        const person = this.personModel.create({
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            emails,
            phones,
            organizationId,
            country: data.country?.trim(),
        });
        return { status: 'created', id: person.id };
    }
    /**
     * Parse emails from import data
     */
    parseEmails(data) {
        const emails = [];
        if (data.email?.trim()) {
            emails.push({ email: data.email.trim().toLowerCase(), label: 'work' });
        }
        if (data.emails?.trim()) {
            const emailList = data.emails.split(/[,;]/).map(e => e.trim().toLowerCase()).filter(Boolean);
            emailList.forEach(email => {
                if (!emails.some(e => e.email === email)) {
                    emails.push({ email, label: 'work' });
                }
            });
        }
        return emails;
    }
    /**
     * Parse phones from import data
     */
    parsePhones(data) {
        const phones = [];
        if (data.phone?.trim()) {
            phones.push({ number: this.normalizePhone(data.phone), type: 'work' });
        }
        if (data.phones?.trim()) {
            const phoneList = data.phones.split(/[,;]/).map(p => p.trim()).filter(Boolean);
            phoneList.forEach(phone => {
                const normalized = this.normalizePhone(phone);
                if (!phones.some(p => p.number === normalized)) {
                    phones.push({ number: normalized, type: 'work' });
                }
            });
        }
        return phones;
    }
    /**
     * Normalize phone number
     */
    normalizePhone(phone) {
        // Remove all non-digit characters except + at the beginning
        return phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
    }
    /**
     * Resolve organization by name (create if doesn't exist)
     */
    resolveOrganization(name) {
        const existing = this.orgModel.searchByOrgName(name);
        // Find exact match (case-insensitive)
        const exactMatch = existing.find(org => org.name.toLowerCase() === name.toLowerCase());
        if (exactMatch) {
            return exactMatch.id;
        }
        // Create new organization
        const org = this.orgModel.create({ name });
        return org.id;
    }
    /**
     * Update existing person
     */
    updateExistingPerson(personId, data, emails, phones) {
        let organizationId;
        if (data.organizationName?.trim()) {
            organizationId = this.resolveOrganization(data.organizationName.trim());
        }
        this.personModel.update(personId, {
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            emails,
            phones,
            organizationId,
            country: data.country?.trim(),
        });
        return { status: 'updated', id: personId };
    }
    /**
     * Validate email format
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    /**
     * Validate phone format
     */
    isValidPhone(phone) {
        // Allow digits, spaces, dashes, parentheses, and + at the beginning
        // Must have at least 7 digits
        const digits = phone.replace(/\D/g, '');
        return digits.length >= 7 && digits.length <= 20;
    }
    /**
     * Get field definitions for mapping suggestions
     */
    static getFieldDefinitions() {
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
}
exports.PersonProcessor = PersonProcessor;
//# sourceMappingURL=personProcessor.js.map