"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileController = void 0;
const responses_1 = require("../../../../shared/responses/responses");
const fileUpload_1 = require("../../../../shared/middleware/fileUpload");
class ProfileController {
    profileService;
    constructor(profileService) {
        this.profileService = profileService;
    }
    async getProfile(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const profile = await this.profileService.getProfile(req.user.id);
            if (!profile) {
                return responses_1.ResponseHandler.notFound(res, 'Profile not found');
            }
            return responses_1.ResponseHandler.success(res, profile);
        }
        catch (error) {
            console.error('Error fetching profile:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to fetch profile');
        }
    }
    async updateProfile(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const existingProfile = await this.profileService.getProfile(req.user.id);
            if (!existingProfile) {
                return responses_1.ResponseHandler.notFound(res, 'Profile not found');
            }
            if (req.processedFiles && req.processedFiles.length > 0) {
                let existingImages = existingProfile.profileImg;
                if (typeof existingImages === 'string') {
                    try {
                        existingImages = JSON.parse(existingImages);
                    }
                    catch (e) {
                        existingImages = undefined;
                    }
                }
                if (Array.isArray(existingImages) && existingImages.length > 0) {
                    const oldKeys = existingImages
                        .filter(img => img?.key)
                        .map(img => img.key);
                    if (oldKeys.length > 0) {
                        await (0, fileUpload_1.safeDeleteFromS3)(oldKeys);
                    }
                }
            }
            const updateData = {
                ...req.body,
                updatedAt: new Date().toISOString()
            };
            if (req.processedFiles && req.processedFiles.length > 0) {
                updateData.profileImg = JSON.stringify(req.processedFiles);
            }
            const profile = await this.profileService.updateProfile(req.user.id, updateData);
            return responses_1.ResponseHandler.success(res, profile, 'Profile updated successfully');
        }
        catch (error) {
            console.error('Error updating profile:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to update profile');
        }
    }
    async deleteProfile(req, res) {
        try {
            if (!req.user) {
                return responses_1.ResponseHandler.validationError(res, 'User not authenticated');
            }
            const existingProfile = await this.profileService.getProfile(req.user.id);
            if (!existingProfile) {
                return responses_1.ResponseHandler.notFound(res, 'Profile not found');
            }
            if (existingProfile.profileImg && existingProfile.profileImg.length > 0) {
                let existingImages = existingProfile.profileImg;
                if (typeof existingImages === 'string') {
                    existingImages = JSON.parse(existingImages);
                }
                if (Array.isArray(existingImages) && existingImages.length > 0) {
                    const oldKeys = existingImages
                        .filter(img => img?.key)
                        .map(img => img.key);
                    if (oldKeys.length > 0) {
                        await (0, fileUpload_1.safeDeleteFromS3)(oldKeys);
                    }
                }
            }
            await this.profileService.deleteProfile(req.user.id);
            return responses_1.ResponseHandler.success(res, null, 'Profile deleted successfully');
        }
        catch (error) {
            console.error('Error deleting profile:', error);
            return responses_1.ResponseHandler.internalError(res, 'Failed to delete profile');
        }
    }
}
exports.ProfileController = ProfileController;
//# sourceMappingURL=profileController.js.map