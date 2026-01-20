import { Response } from 'express';
import { ProfileService } from '../services/profileService';
import { AuthenticatedRequest } from '../../../../shared/types';
import { ResponseHandler } from '../../../../shared/responses/responses';
import { safeDeleteFromS3 } from '../../../../shared/middleware/fileUpload';

export class ProfileController {
    constructor(private profileService: ProfileService) { }

    async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }

            const profile = await this.profileService.getProfile(req.user.id);

            if (!profile) {
                return ResponseHandler.notFound(res, 'Profile not found');
            }

            return ResponseHandler.success(res, profile);
        } catch (error) {
            console.error('Error fetching profile:', error);
            return ResponseHandler.internalError(res, 'Failed to fetch profile');
        }
    }

    async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }

            const existingProfile = await this.profileService.getProfile(req.user.id);
            if (!existingProfile) {
                return ResponseHandler.notFound(res, 'Profile not found');
            }

            if (req.processedFiles && req.processedFiles.length > 0) {
                let existingImages = existingProfile.profileImg;

                if (typeof existingImages === 'string') {
                    try {
                        existingImages = JSON.parse(existingImages);
                    } catch (e) {
                        existingImages = undefined;
                    }
                }

                if (Array.isArray(existingImages) && existingImages.length > 0) {
                    const oldKeys = existingImages
                        .filter(img => img?.key)
                        .map(img => img.key);

                    if (oldKeys.length > 0) {
                        await safeDeleteFromS3(oldKeys);
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

            return ResponseHandler.success(res, profile, 'Profile updated successfully');
        } catch (error) {
            console.error('Error updating profile:', error);
            return ResponseHandler.internalError(res, 'Failed to update profile');
        }
    }

    async deleteProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
        try {
            if (!req.user) {
                return ResponseHandler.validationError(res, 'User not authenticated');
            }
            const existingProfile = await this.profileService.getProfile(req.user.id);
            if (!existingProfile) {
                return ResponseHandler.notFound(res, 'Profile not found');
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
                        await safeDeleteFromS3(oldKeys);
                    }
                }
            }


            await this.profileService.deleteProfile(req.user.id);

            return ResponseHandler.success(res, null, 'Profile deleted successfully');
        } catch (error) {
            console.error('Error deleting profile:', error);
            return ResponseHandler.internalError(res, 'Failed to delete profile');
        }
    }
}