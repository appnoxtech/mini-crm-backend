import Database from 'better-sqlite3';
import { User, AuthUser } from '../../../shared/types';

export class UserModel {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  initialize(): void {
    // Create users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        passwordHash TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);
    
    // Create indexes
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  }

  createUser(email: string, name: string, passwordHash: string): User {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO users (email, name, passwordHash, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(email.toLowerCase(), name, passwordHash, now, now);
    
    return {
      id: result.lastInsertRowid as number,
      email: email.toLowerCase(),
      name,
      passwordHash,
      createdAt: now,
      updatedAt: now
    };
  }

  findByEmail(email: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email.toLowerCase()) as User | undefined;
  }

  findById(id: number): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id) as User | undefined;
  }

  updateUser(id: number, updates: Partial<{ name: string; email: string }>): AuthUser | null {
    try {
      const user = this.findById(id);
      if (!user) return null;

      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: any[] = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }

      if (updates.email !== undefined) {
        fields.push('email = ?');
        values.push(updates.email.toLowerCase());
      }

      if (fields.length === 0) return null;

      fields.push('updatedAt = ?');
      values.push(now);
      values.push(id);

      const stmt = this.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
      stmt.run(...values);

      const updatedUser = this.findById(id);
      if (!updatedUser) return null;

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        createdAt: updatedUser.createdAt
      };
    } catch (error) {
      console.error('Error updating user:', error);
      return null;
    }
  }

  updatePassword(id: number, passwordHash: string): boolean {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare('UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?');
      const result = stmt.run(passwordHash, now, id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating password:', error);
      return false;
    }
  }
}
