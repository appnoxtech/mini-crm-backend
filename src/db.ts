import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

export type LeadStage = "OPEN" | "WON" | "LOST";

export interface Lead {
  id: number;
  name: string;
  company: string | null;
  value: number | null;
  notes: string | null;
  stage: LeadStage;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

// Ensure data directory exists (place DB file next to project root by default)
const dbFile = path.resolve(process.cwd(), "data.db");

// Create database connection
export const db = new Database(dbFile);

// Pragmas for reliability and performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company TEXT,
    value REAL,
    notes TEXT,
    stage TEXT NOT NULL CHECK (stage IN ('OPEN','WON','LOST')) DEFAULT 'OPEN',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
  CREATE INDEX IF NOT EXISTS idx_leads_createdAt ON leads(createdAt);
  CREATE INDEX IF NOT EXISTS idx_leads_updatedAt ON leads(updatedAt);
  CREATE INDEX IF NOT EXISTS idx_leads_name ON leads(name);
`);

export function mapRowToLead(row: any): Lead {
  return {
    id: row.id,
    name: row.name,
    company: row.company ?? null,
    value: row.value !== null && row.value !== undefined ? Number(row.value) : null,
    notes: row.notes ?? null,
    stage: row.stage as LeadStage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}



