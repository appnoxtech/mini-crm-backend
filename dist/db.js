"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const auth_1 = require("./auth");
const db = new better_sqlite3_1.default('data.db');
// Initialize database tables
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
// Initialize auth tables
(0, auth_1.initializeAuth)(db);
exports.default = db;
//# sourceMappingURL=db.js.map