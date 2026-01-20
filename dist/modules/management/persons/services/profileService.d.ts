import { UserModel } from "../../../auth/models/User";
import { AuthUser, User } from "../../../../shared/types";
export declare class ProfileService {
    private userModel;
    constructor(userModel: UserModel);
    updateProfile(userId: number, updates: Partial<User>): Promise<AuthUser | null>;
    getProfile(userId: number): Promise<AuthUser | null>;
    deleteProfile(userId: number): Promise<AuthUser | null>;
}
//# sourceMappingURL=profileService.d.ts.map