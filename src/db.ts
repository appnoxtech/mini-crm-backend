import Database from 'better-sqlite3';
import { initializeAuth } from './auth';

const db: Database.Database = new Database('data.db');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize auth tables first
initializeAuth(db);

// Check if leads table exists and has userId column
const tableInfo = db.prepare("PRAGMA table_info(leads)").all();
const hasUserIdColumn = tableInfo.some((col: any) => col.name === 'userId');

if (!hasUserIdColumn) {
  // If leads table exists but doesn't have userId, we need to migrate
  const leadsExist = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='leads'").get();
  
  if (leadsExist) {
    // Backup existing data
    const existingLeads = db.prepare('SELECT * FROM leads').all();
    
    // Drop the old table
    db.exec('DROP TABLE IF EXISTS leads');
    db.exec('DROP TABLE IF EXISTS lead_history');
  }
}

// Initialize database tables with new schema
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company TEXT,
    value REAL,
    stage TEXT NOT NULL DEFAULT 'OPEN',
    notes TEXT,
    userId INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    closedAt TEXT,
    FOREIGN KEY (userId) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS lead_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leadId INTEGER NOT NULL,
    type TEXT NOT NULL,
    text TEXT NOT NULL,
    at TEXT NOT NULL,
    FOREIGN KEY (leadId) REFERENCES leads(id) ON DELETE CASCADE
  )
`);

// Create indexes
db.exec('CREATE INDEX IF NOT EXISTS idx_leads_userId ON leads(userId)');
db.exec('CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage)');
db.exec('CREATE INDEX IF NOT EXISTS idx_leads_createdAt ON leads(createdAt)');
db.exec('CREATE INDEX IF NOT EXISTS idx_lead_history_leadId ON lead_history(leadId)');

export default db;



