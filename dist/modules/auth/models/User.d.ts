import Database from 'better-sqlite3';
import { User, AuthUser } from '../../../shared/types';
export declare class UserModel {
    private db;
    constructor(db: Database.Database);
    initialize(): void;
    createUser(email: string, name: string, passwordHash: string): User;
    findByEmail(email: string): User | undefined;
    findById(id: number): User | undefined;
    updateUser(id: number, updates: Partial<User>): AuthUser | null;
    getProfile(id: number): AuthUser | null;
    updatePassword(id: number, passwordHash: string): boolean;
}
//# sourceMappingURL=User.d.ts.map