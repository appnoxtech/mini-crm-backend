"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeAuth = initializeAuth;
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
exports.createUser = createUser;
exports.findUserByEmail = findUserByEmail;
exports.findUserById = findUserById;
exports.authenticateUser = authenticateUser;
exports.updateUser = updateUser;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;
function initializeAuth(db) {
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
function hashPassword(password) {
    return bcryptjs_1.default.hash(password, SALT_ROUNDS);
}
function comparePassword(password, hash) {
    return bcryptjs_1.default.compare(password, hash);
}
function generateToken(user) {
    return jsonwebtoken_1.default.sign({
        id: user.id,
        email: user.email,
        name: user.name
    }, JWT_SECRET, { expiresIn: '7d' });
}
function verifyToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return decoded;
    }
    catch (error) {
        return null;
    }
}
function createUser(db, email, name, password) {
    return new Promise(async (resolve, reject) => {
        try {
            const passwordHash = await hashPassword(password);
            const now = new Date().toISOString();
            const stmt = db.prepare(`
        INSERT INTO users (email, name, passwordHash, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?)
      `);
            const result = stmt.run(email.toLowerCase(), name, passwordHash, now, now);
            const user = {
                id: result.lastInsertRowid,
                email: email.toLowerCase(),
                name,
                createdAt: now
            };
            resolve(user);
        }
        catch (error) {
            reject(error);
        }
    });
}
function findUserByEmail(db, email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email.toLowerCase());
}
function findUserById(db, id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
}
function authenticateUser(db, email, password) {
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
            const authUser = {
                id: user.id,
                email: user.email,
                name: user.name,
                createdAt: user.createdAt
            };
            resolve(authUser);
        }
        catch (error) {
            reject(error);
        }
    });
}
function updateUser(db, id, updates) {
    try {
        const user = findUserById(db, id);
        if (!user)
            return null;
        const now = new Date().toISOString();
        const fields = [];
        const values = [];
        if (updates.name !== undefined) {
            fields.push('name = ?');
            values.push(updates.name);
        }
        if (updates.email !== undefined) {
            fields.push('email = ?');
            values.push(updates.email.toLowerCase());
        }
        if (fields.length === 0)
            return null;
        fields.push('updatedAt = ?');
        values.push(now);
        values.push(id);
        const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...values);
        const updatedUser = findUserById(db, id);
        if (!updatedUser)
            return null;
        return {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            createdAt: updatedUser.createdAt
        };
    }
    catch (error) {
        console.error('Error updating user:', error);
        return null;
    }
}
//# sourceMappingURL=auth.js.map