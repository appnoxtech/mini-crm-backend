import Database from 'better-sqlite3';
import { ImportError, OrganizationImportData, ProcessResult, DuplicateHandling } from '../../types';
export declare class OrganizationProcessor {
    private db;
    private orgModel;
    constructor(db: Database.Database);
    /**
     * Validate organization data
     */
    validate(data: OrganizationImportData, rowNumber: number): ImportError[];
    /**
     * Check for duplicates by name
     */
    checkDuplicate(data: OrganizationImportData): {
        isDuplicate: boolean;
        existingId?: number;
    };
    /**
     * Process a single organization record
     */
    process(data: OrganizationImportData, userId: number, duplicateHandling: DuplicateHandling): ProcessResult;
    /**
     * Prepare organization data from import data
     */
    private prepareOrganizationData;
    /**
     * Update existing organization
     */
    private updateExistingOrganization;
    /**
     * Parse emails from import data
     */
    private parseEmails;
    /**
     * Parse phones from import data
     */
    private parsePhones;
    /**
     * Parse address from import data
     */
    private parseAddress;
    /**
     * Normalize phone number
     */
    private normalizePhone;
    /**
     * Validate email format
     */
    private isValidEmail;
    /**
     * Validate URL format
     */
    private isValidUrl;
    /**
     * Validate LinkedIn URL
     */
    private isValidLinkedInUrl;
    /**
     * Get field definitions for mapping suggestions
     */
    static getFieldDefinitions(): {
        name: string;
        type: string;
        required: boolean;
        aliases: string[];
    }[];
}
//# sourceMappingURL=organizationProcessor.d.ts.map