"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileParserService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FileParserService {
    /**
     * Parse uploaded file and extract data
     */
    async parse(filePath, format) {
        switch (format) {
            case 'csv':
                return this.parseCSV(filePath);
            case 'xlsx':
                return this.parseXLSX(filePath);
            case 'json':
                return this.parseJSON(filePath);
            default:
                throw new Error(`Unsupported file format: ${format}`);
        }
    }
    /**
     * Parse CSV file
     */
    async parseCSV(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/).filter(line => line.trim());
        if (lines.length === 0) {
            throw new Error('CSV file is empty');
        }
        // Parse headers (first line)
        const headers = this.parseCSVLine(lines[0]);
        // Parse data rows
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line)
                continue;
            const row = this.parseCSVLine(line);
            if (row.length > 0 && row.some(cell => cell.trim())) {
                rows.push(row);
            }
        }
        // Get sample rows (first 5)
        const sampleRows = rows.slice(0, 5);
        return {
            headers,
            rows,
            sampleRows,
            totalRows: rows.length,
        };
    }
    /**
     * Parse a single CSV line, handling quoted values
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            if (inQuotes) {
                if (char === '"' && nextChar === '"') {
                    // Escaped quote
                    current += '"';
                    i++;
                }
                else if (char === '"') {
                    // End of quoted section
                    inQuotes = false;
                }
                else {
                    current += char;
                }
            }
            else {
                if (char === '"') {
                    // Start of quoted section
                    inQuotes = true;
                }
                else if (char === ',') {
                    // End of field
                    result.push(current.trim());
                    current = '';
                }
                else {
                    current += char;
                }
            }
        }
        // Add last field
        result.push(current.trim());
        return result;
    }
    /**
     * Parse XLSX file (requires xlsx package)
     */
    async parseXLSX(filePath) {
        try {
            // Dynamic import xlsx to avoid build issues if not installed
            const XLSX = require('xlsx');
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            // Convert to array of arrays
            const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            if (data.length === 0) {
                throw new Error('Excel file is empty');
            }
            const headers = (data[0] || []).map((h) => String(h || ''));
            const rows = data.slice(1).filter((row) => row.some(cell => cell != null && cell !== ''));
            const sampleRows = rows.slice(0, 5);
            return {
                headers,
                rows,
                sampleRows,
                totalRows: rows.length,
            };
        }
        catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                throw new Error('XLSX parsing requires the xlsx package. Please install it with: npm install xlsx');
            }
            throw error;
        }
    }
    /**
     * Parse JSON file
     */
    async parseJSON(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const json = JSON.parse(content);
        let data;
        // Support both array format and { data: [...] } format
        if (Array.isArray(json)) {
            data = json;
        }
        else if (json.data && Array.isArray(json.data)) {
            data = json.data;
        }
        else {
            throw new Error('Invalid JSON format. Expected an array or an object with a "data" array.');
        }
        if (data.length === 0) {
            throw new Error('JSON file contains no data');
        }
        // Extract headers from first object keys
        const headers = Object.keys(data[0]);
        // Convert objects to arrays
        const rows = data.map(item => headers.map(h => item[h] ?? ''));
        const sampleRows = rows.slice(0, 5);
        return {
            headers,
            rows,
            sampleRows,
            totalRows: rows.length,
        };
    }
    /**
     * Detect file format from extension or content
     */
    detectFormat(fileName) {
        const ext = path.extname(fileName).toLowerCase();
        switch (ext) {
            case '.csv':
                return 'csv';
            case '.xlsx':
            case '.xls':
                return 'xlsx';
            case '.json':
                return 'json';
            default:
                throw new Error(`Unsupported file extension: ${ext}`);
        }
    }
    /**
     * Validate file size
     */
    validateFileSize(filePath, maxSizeMB = 10) {
        const stats = fs.statSync(filePath);
        const fileSizeMB = stats.size / (1024 * 1024);
        if (fileSizeMB > maxSizeMB) {
            throw new Error(`File size (${fileSizeMB.toFixed(2)}MB) exceeds maximum allowed size (${maxSizeMB}MB)`);
        }
    }
    /**
     * Get row value by header name
     */
    getRowValue(row, headers, headerName) {
        const index = headers.findIndex(h => h.toLowerCase() === headerName.toLowerCase());
        return index >= 0 ? row[index] : undefined;
    }
    /**
     * Map row data using field mappings
     */
    mapRowData(row, headers, mappings) {
        const result = {};
        for (const mapping of mappings) {
            const sourceIndex = headers.findIndex(h => h === mapping.sourceColumn);
            if (sourceIndex >= 0) {
                let value = row[sourceIndex];
                // Trim string values
                if (typeof value === 'string') {
                    value = value.trim();
                }
                result[mapping.targetField] = value;
            }
        }
        return result;
    }
}
exports.FileParserService = FileParserService;
//# sourceMappingURL=fileParserService.js.map