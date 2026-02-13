import { UserModel } from "../../../auth/models/User";
import { AuthUser, User } from "../../../../shared/types";

export class ProfileService {
    constructor(private userModel: UserModel) { }

    async updateProfile(userId: number, companyId: number, updates: Partial<User>): Promise<AuthUser | null> {
        return this.userModel.updateUser(userId, companyId, updates);
    }

    async getProfile(userId: number, companyId: number): Promise<AuthUser | null> {
        return this.userModel.getProfile(userId, companyId);
    }

    async deleteProfile(userId: number, companyId: number): Promise<AuthUser | null> {
        // "Deleting" a profile in this context means clearing profile fields
        return this.userModel.updateUser(userId, companyId, {
            profileImg: undefined,
            phone: undefined,
            dateFormat: undefined,
            timezone: undefined,
            language: undefined,
            defaultCurrency: undefined
        });
    }
}