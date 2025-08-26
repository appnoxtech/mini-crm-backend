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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("./auth");
const middleware_1 = require("./middleware");
const db_1 = __importDefault(require("./db"));
const router = (0, express_1.Router)();
// Register new user
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        // Validation
        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        if (!email.includes('@')) {
            return res.status(400).json({ error: 'Please enter a valid email address' });
        }
        // Check if user already exists
        const existingUser = db_1.default.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
        if (existingUser) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }
        // Create user
        const user = await (0, auth_1.createUser)(db_1.default, email, name, password);
        const token = (0, auth_1.generateToken)(user);
        res.status(201).json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                createdAt: user.createdAt
            },
            token
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});
// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        // Authenticate user
        const user = await (0, auth_1.authenticateUser)(db_1.default, email, password);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const token = (0, auth_1.generateToken)(user);
        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                createdAt: user.createdAt
            },
            token
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});
// Get current user profile
router.get('/profile', middleware_1.authMiddleware, (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        res.json({
            user: {
                id: req.user.id,
                email: req.user.email,
                name: req.user.name,
                createdAt: req.user.createdAt
            }
        });
    }
    catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});
// Update user profile
router.put('/profile', middleware_1.authMiddleware, (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { name, email } = req.body;
        const updates = {};
        if (name !== undefined) {
            if (!name.trim()) {
                return res.status(400).json({ error: 'Name cannot be empty' });
            }
            updates.name = name.trim();
        }
        if (email !== undefined) {
            if (!email.includes('@')) {
                return res.status(400).json({ error: 'Please enter a valid email address' });
            }
            // Check if email is already taken by another user
            const existingUser = db_1.default.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase(), req.user.id);
            if (existingUser) {
                return res.status(409).json({ error: 'Email is already taken' });
            }
            updates.email = email.toLowerCase();
        }
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid updates provided' });
        }
        const updatedUser = (0, auth_1.updateUser)(db_1.default, req.user.id, updates);
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                createdAt: updatedUser.createdAt
            }
        });
    }
    catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});
// Change password
router.put('/change-password', middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
        // Get current user with password hash
        const user = (0, auth_1.findUserById)(db_1.default, req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Verify current password
        const { comparePassword, hashPassword } = await Promise.resolve().then(() => __importStar(require('./auth')));
        const isValid = await comparePassword(currentPassword, user.passwordHash);
        if (!isValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        // Hash new password and update
        const newPasswordHash = await hashPassword(newPassword);
        const now = new Date().toISOString();
        db_1.default.prepare('UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?').run(newPasswordHash, now, req.user.id);
        res.json({ message: 'Password updated successfully' });
    }
    catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});
exports.default = router;
//# sourceMappingURL=authRoutes.js.map