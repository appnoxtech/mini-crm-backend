import Database from 'better-sqlite3';
import { User, AuthUser } from '../../../shared/types';
type LoginUserResponse = {
    id: number;
    email: string;
    name: string;
    profileImg: any[];
    phone: string | null;
    dateFormat: string | null;
    timezone: string | null;
    language: string | null;
    defaultCurrency: string | null;
    createdAt: string;
    updatedAt: string;
    role: string | null;
};
export declare class UserModel {
    private db;
    constructor(db: Database.Database);
    initialize(): void;
    createUser(email: string, name: string, passwordHash: string, role: string): User;
    findByEmail(email: string): User | undefined;
    findById(id: number): User | undefined;
    updateUser(id: number, updates: Partial<User>): AuthUser | null;
    getProfile(id: number): AuthUser | null;
    updatePassword(id: number, passwordHash: string): boolean;
    updateAccountRole(id: number, role: string): boolean;
    searchByPersonName(search: string): LoginUserResponse[];
    private mapToLoginUser;
}
export {};
//# sourceMappingURL=User.d.ts.map