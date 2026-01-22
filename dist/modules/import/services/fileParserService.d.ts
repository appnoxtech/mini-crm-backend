import { ParsedFileData, ImportFileFormat } from '../types';
export declare class FileParserService {
    /**
     * Parse uploaded file and extract data
     */
    parse(filePath: string, format: ImportFileFormat): Promise<ParsedFileData>;
    /**
     * Parse CSV file
     */
    private parseCSV;
    /**
     * Parse a single CSV line, handling quoted values
     */
    private parseCSVLine;
    /**
     * Parse XLSX file (requires xlsx package)
     */
    private parseXLSX;
    /**
     * Parse JSON file
     */
    private parseJSON;
    /**
     * Detect file format from extension or content
     */
    detectFormat(fileName: string): ImportFileFormat;
    /**
     * Validate file size
     */
    validateFileSize(filePath: string, maxSizeMB?: number): void;
    /**
     * Get row value by header name
     */
    getRowValue(row: any[], headers: string[], headerName: string): any;
    /**
     * Map row data using field mappings
     */
    mapRowData(row: any[], headers: string[], mappings: {
        sourceColumn: string;
        targetField: string;
    }[]): Record<string, any>;
}
//# sourceMappingURL=fileParserService.d.ts.map