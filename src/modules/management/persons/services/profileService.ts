import { UserModel } from "../../../auth/models/User";
import { AuthUser, User } from "../../../../shared/types";

export class ProfileService {
    constructor(private userModel: UserModel) { }

    async updateProfile(userId: number, updates: Partial<User>): Promise<AuthUser | null> {
        return this.userModel.updateUser(userId, updates);
    }

    async getProfile(userId: number): Promise<AuthUser | null> {
        return this.userModel.getProfile(userId);
    }

    async deleteProfile(userId: number): Promise<AuthUser | null> {
        // "Deleting" a profile in this context means clearing profile fields
        return this.userModel.updateUser(userId, {
            profileImg: undefined,
            phone: undefined,
            dateFormat: undefined,
            timezone: undefined,
            language: undefined,
            defaultCurrency: undefined
        });
    }
}