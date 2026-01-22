export type ImportEntityType = 'person' | 'organization' | 'deal' | 'lead' | 'note' | 'activity';
export type ImportStatus = 'pending' | 'validating' | 'mapping' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type ImportFileFormat = 'csv' | 'xlsx' | 'json';
export type DuplicateHandling = 'skip' | 'update' | 'create' | 'error';
export interface ImportJob {
    id: number;
    userId: number;
    entityType: ImportEntityType;
    fileName: string;
    fileFormat: ImportFileFormat;
    status: ImportStatus;
    totalRows: number;
    processedRows: number;
    successCount: number;
    errorCount: number;
    skippedCount: number;
    duplicateHandling: DuplicateHandling;
    mapping: FieldMapping[];
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    errorSummary?: string;
}
export interface FieldMapping {
    sourceColumn: string;
    targetField: string;
    isRequired: boolean;
    defaultValue?: any;
    transformFunction?: string;
}
export interface ImportPreview {
    importId: number;
    headers: string[];
    sampleRows: any[][];
    totalRows: number;
    suggestedMappings: FieldMapping[];
}
export interface ImportResult {
    importId: number;
    status: ImportStatus;
    summary: {
        total: number;
        success: number;
        errors: number;
        skipped: number;
        duplicates: number;
    };
    errors: ImportError[];
    createdEntityIds: number[];
}
export interface ImportError {
    row: number;
    column?: string;
    value?: any;
    errorType: 'validation' | 'duplicate' | 'reference' | 'system';
    message: string;
}
export interface ImportTemplate {
    id: number;
    userId: number;
    name: string;
    entityType: ImportEntityType;
    mapping: FieldMapping[];
    createdAt: string;
}
export interface ParsedFileData {
    headers: string[];
    rows: any[][];
    sampleRows: any[][];
    totalRows: number;
}
export interface FieldDefinition {
    name: string;
    type: 'string' | 'number' | 'date' | 'boolean' | 'array';
    required: boolean;
    aliases?: string[];
}
export interface ProcessResult {
    status: 'created' | 'updated' | 'skipped';
    id?: number;
}
export interface PersonImportData {
    firstName: string;
    lastName: string;
    email?: string;
    emails?: string;
    phone?: string;
    phones?: string;
    organizationName?: string;
    country?: string;
}
export interface OrganizationImportData {
    name: string;
    description?: string;
    industry?: string;
    website?: string;
    email?: string;
    emails?: string;
    phone?: string;
    phones?: string;
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
    annualRevenue?: number;
    numberOfEmployees?: number;
    linkedinProfile?: string;
}
//# sourceMappingURL=index.d.ts.map