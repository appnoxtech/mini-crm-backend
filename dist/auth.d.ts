import Database from 'better-sqlite3';
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
export declare function initializeAuth(db: Database.Database): void;
export declare function hashPassword(password: string): Promise<string>;
export declare function comparePassword(password: string, hash: string): Promise<boolean>;
export declare function generateToken(user: AuthUser): string;
export declare function verifyToken(token: string): AuthUser | null;
export declare function createUser(db: Database.Database, email: string, name: string, password: string): Promise<AuthUser>;
export declare function findUserByEmail(db: Database.Database, email: string): User | undefined;
export declare function findUserById(db: Database.Database, id: number): User | undefined;
export declare function authenticateUser(db: Database.Database, email: string, password: string): Promise<AuthUser | null>;
export declare function updateUser(db: Database.Database, id: number, updates: Partial<{
    name: string;
    email: string;
}>): AuthUser | null;
//# sourceMappingURL=auth.d.ts.map