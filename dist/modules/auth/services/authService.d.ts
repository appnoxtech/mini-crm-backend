import { AuthUser } from '../../../shared/types';
import { UserModel } from '../models/User';
export declare class AuthService {
    private userModel;
    constructor(userModel: UserModel);
    hashPassword(password: string): Promise<string>;
    comparePassword(password: string, hash: string): Promise<boolean>;
    generateToken(user: AuthUser): string;
    verifyToken(token: string): AuthUser | null;
    createUser(email: string, name: string, password: string): Promise<AuthUser>;
    authenticateUser(email: string, password: string): Promise<AuthUser | null>;
    getProfile(id: number): Promise<AuthUser | null>;
    updateUser(id: number, updates: Partial<{
        name: string;
        email: string;
    }>): Promise<AuthUser | null>;
    changePassword(id: number, currentPassword: string, newPassword: string): Promise<boolean>;
    changeAccountRole(id: number, role: string): Promise<boolean>;
    searchByPersonName(searchTerm: string): Promise<any>;
}
export declare function hashPassword(password: string): Promise<string>;
export declare function comparePassword(password: string, hash: string): Promise<boolean>;
export declare function generateToken(user: AuthUser): string;
export declare function verifyToken(token: string): AuthUser | null;
//# sourceMappingURL=authService.d.ts.map