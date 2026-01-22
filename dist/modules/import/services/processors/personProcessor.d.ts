import Database from 'better-sqlite3';
import { ImportError, PersonImportData, ProcessResult, DuplicateHandling } from '../../types';
export declare class PersonProcessor {
    private db;
    private personModel;
    private orgModel;
    constructor(db: Database.Database);
    /**
     * Validate person data
     */
    validate(data: PersonImportData, rowNumber: number): ImportError[];
    /**
     * Check for duplicates
     */
    checkDuplicate(data: PersonImportData): {
        isDuplicate: boolean;
        existingId?: number;
        field?: string;
        value?: string;
    };
    /**
     * Process a single person record
     */
    process(data: PersonImportData, userId: number, duplicateHandling: DuplicateHandling): ProcessResult;
    /**
     * Parse emails from import data
     */
    private parseEmails;
    /**
     * Parse phones from import data
     */
    private parsePhones;
    /**
     * Normalize phone number
     */
    private normalizePhone;
    /**
     * Resolve organization by name (create if doesn't exist)
     */
    private resolveOrganization;
    /**
     * Update existing person
     */
    private updateExistingPerson;
    /**
     * Validate email format
     */
    private isValidEmail;
    /**
     * Validate phone format
     */
    private isValidPhone;
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
//# sourceMappingURL=personProcessor.d.ts.map