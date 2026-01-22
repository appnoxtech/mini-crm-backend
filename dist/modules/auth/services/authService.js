"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
exports.generateToken = generateToken;
exports.verifyToken = verifyToken;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;
class AuthService {
    userModel;
    constructor(userModel) {
        this.userModel = userModel;
    }
    async hashPassword(password) {
        return bcryptjs_1.default.hash(password, SALT_ROUNDS);
    }
    async comparePassword(password, hash) {
        return bcryptjs_1.default.compare(password, hash);
    }
    generateToken(user) {
        return jsonwebtoken_1.default.sign({
            id: user.id,
            email: user.email,
            name: user.name
        }, JWT_SECRET, { expiresIn: '7d' });
    }
    verifyToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            return decoded;
        }
        catch (error) {
            return null;
        }
    }
    async createUser(email, name, password) {
        const passwordHash = await this.hashPassword(password);
        const user = this.userModel.createUser(email, name, passwordHash, 'user');
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt
        };
    }
    async authenticateUser(email, password) {
        try {
            const user = this.userModel.findByEmail(email);
            if (!user) {
                return null;
            }
            const isValid = await this.comparePassword(password, user.passwordHash);
            if (!isValid) {
                return null;
            }
            const { passwordHash, ...safeUser } = user;
            safeUser.profileImg = JSON.parse(safeUser.profileImg || '[]');
            return safeUser;
        }
        catch (error) {
            console.error('Authentication error:', error);
            return null;
        }
    }
    async getProfile(id) {
        const user = this.userModel.findById(id);
        if (!user)
            return null;
        return {
            ...user,
            profileImg: JSON.parse(user.profileImg || '[]')
        };
    }
    async updateUser(id, updates) {
        const user = this.userModel.updateUser(id, updates);
        if (!user)
            return null;
        return {
            ...user,
            profileImg: JSON.parse(user.profileImg || '[]')
        };
    }
    async changePassword(id, currentPassword, newPassword) {
        try {
            const user = this.userModel.findById(id);
            if (!user) {
                return false;
            }
            const isValid = await this.comparePassword(currentPassword, user.passwordHash);
            if (!isValid) {
                return false;
            }
            const newPasswordHash = await this.hashPassword(newPassword);
            return this.userModel.updatePassword(id, newPasswordHash);
        }
        catch (error) {
            console.error('Password change error:', error);
            return false;
        }
    }
    async changeAccountRole(id, role) {
        try {
            return this.userModel.updateAccountRole(id, role);
        }
        catch (error) {
            console.error('Account role change error:', error);
            return false;
        }
    }
    async searchByPersonName(searchTerm) {
        if (!searchTerm || !searchTerm.trim()) {
            return;
        }
        return this.userModel.searchByPersonName(searchTerm.trim());
    }
}
exports.AuthService = AuthService;
// Export individual functions for backward compatibility
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
//# sourceMappingURL=authService.js.map