import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;

export interface User {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}

export function initializeAuth(db: Database.Database) {
  // Create users table
  db.exec(`
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
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      name: user.name 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch (error) {
    return null;
  }
}

export function createUser(db: Database.Database, email: string, name: string, password: string): Promise<AuthUser> {
  return new Promise(async (resolve, reject) => {
    try {
      const passwordHash = await hashPassword(password);
      const now = new Date().toISOString();
      
      const stmt = db.prepare(`
        INSERT INTO users (email, name, passwordHash, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(email.toLowerCase(), name, passwordHash, now, now);
      
      const user: AuthUser = {
        id: result.lastInsertRowid as number,
        email: email.toLowerCase(),
        name,
        createdAt: now
      };
      
      resolve(user);
    } catch (error) {
      reject(error);
    }
  });
}

export function findUserByEmail(db: Database.Database, email: string): User | undefined {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email.toLowerCase()) as User | undefined;
}

export function findUserById(db: Database.Database, id: number): User | undefined {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) as User | undefined;
}

export function authenticateUser(db: Database.Database, email: string, password: string): Promise<AuthUser | null> {
  return new Promise(async (resolve, reject) => {
    try {
      const user = findUserByEmail(db, email);
      if (!user) {
        resolve(null);
        return;
      }

      const isValid = await comparePassword(password, user.passwordHash);
      if (!isValid) {
        resolve(null);
        return;
      }

      const authUser: AuthUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      };

      resolve(authUser);
    } catch (error) {
      reject(error);
    }
  });
}

export function updateUser(db: Database.Database, id: number, updates: Partial<{ name: string; email: string }>): AuthUser | null {
  try {
    const user = findUserById(db, id);
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

    const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    const updatedUser = findUserById(db, id);
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
