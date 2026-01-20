"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileService = void 0;
class ProfileService {
    userModel;
    constructor(userModel) {
        this.userModel = userModel;
    }
    async updateProfile(userId, updates) {
        return this.userModel.updateUser(userId, updates);
    }
    async getProfile(userId) {
        return this.userModel.getProfile(userId);
    }
    async deleteProfile(userId) {
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
exports.ProfileService = ProfileService;
//# sourceMappingURL=profileService.js.map