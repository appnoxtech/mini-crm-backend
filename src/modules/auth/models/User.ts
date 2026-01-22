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
        profileImg TEXT,
        phone TEXT,
        role TEXT DEFAULT user,
        dateFormat TEXT,
        timezone TEXT,
        language TEXT,
        defaultCurrency TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // Add columns if they don't exist (handle migration for existing tables)
    const columns = [
      { name: 'profileImg', type: 'TEXT' },
      { name: 'phone', type: 'TEXT' },
      { name: 'role', type: 'TEXT' },
      { name: 'dateFormat', type: 'TEXT' },
      { name: 'timezone', type: 'TEXT' },
      { name: 'language', type: 'TEXT' },
      { name: 'defaultCurrency', type: 'TEXT' }
    ];

    columns.forEach(col => {
      try {
        this.db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
      } catch (e) {
        // Column probably already exists or table doesn't exist yet (handled by CREATE TABLE)
      }
    });

    // Create indexes
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  }

  createUser(email: string, name: string, passwordHash: string, role: string): User {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO users (email, name, passwordHash, role, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(email.toLowerCase(), name, passwordHash, role, now, now);

    return {
      id: result.lastInsertRowid as number,
      email: email.toLowerCase(),
      name,
      passwordHash,
      role,
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

  updateUser(id: number, updates: Partial<User>): AuthUser | null {
    try {
      const user = this.findById(id);
      if (!user) return null;

      const now = new Date().toISOString();
      const fields: string[] = [];
      const values: any[] = [];

      const allowedUpdates: (keyof User)[] = [
        'name', 'email', 'profileImg', 'phone', 'dateFormat',
        'timezone', 'language', 'defaultCurrency'
      ];

      allowedUpdates.forEach(key => {
        if (updates[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(key === 'email' ? (updates[key] as string).toLowerCase() : updates[key]);
        }
      });

      if (fields.length === 0) return null;

      fields.push('updatedAt = ?');
      values.push(now);
      values.push(id);

      const stmt = this.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
      stmt.run(...values);

      const updatedUser = this.findById(id);
      if (!updatedUser) return null;

      const { passwordHash, ...safeUser } = updatedUser;
      return { ...safeUser, profileImg: JSON.parse(safeUser.profileImg || '[]') };
    } catch (error) {
      console.error('Error updating user:', error);
      return null;
    }
  }

  getProfile(id: number): AuthUser | null {
    const user = this.findById(id);
    if (!user) return null;
    const { passwordHash, ...profile } = user;
    return { ...profile, profileImg: JSON.parse(profile?.profileImg || '[]') };
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

  updateAccountRole(id: number, role: string): boolean {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare('UPDATE users SET role = ?, updatedAt = ? WHERE id = ?');
      const result = stmt.run(role, now, id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating account role:', error);
      return false;
    }
  }
}
