import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { AuthenticatedRequest } from '../../../shared/types';
import { UserModel } from '../models/User';
import { ResponseHandler, ErrorCodes } from '../../../shared/responses/responses';
import { EmailModel } from '../../email/models/emailModel';
import { OAuthService } from '../../email/services/oauthService';

export class AuthController {
  private authService: AuthService;
  private userModel: UserModel;
  private emailModel: EmailModel;
  private oauthService: OAuthService;

  constructor(authService: AuthService, userModel: UserModel) {
    this.authService = authService;
    this.userModel = userModel;
    this.emailModel = new EmailModel();
    this.oauthService = new OAuthService();
  }

  async register(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, password, role = 'user' } = req.body as any;

      if (!name || !email || !password) {
        return ResponseHandler.validationError(res, 'Missing required fields: name, email, password');
      }

      // Check if user already exists
      const existingUser = await this.userModel.findByEmail(email);

      if (existingUser) {
        return ResponseHandler.conflict(res, 'User already exists', { email });
      }

      // Create user using auth service
      const user = await this.authService.createUser(email, name, password, role);

      if (!user) {
        return ResponseHandler.error(res, "Failed to create user", 500);
      }

      return ResponseHandler.created(res, user, 'User Registered Successfully');
    } catch (error: any) {
      console.error('Registration error:', error);
      return ResponseHandler.internalError(res, 'Registration failed');
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Authenticate user
      const user = await this.authService.authenticateUser(email, password);

      if (!user) {
        return ResponseHandler.error(res, 'Invalid email or password');
      }

      const token = this.authService.generateToken(user);

      // Check if user has email account setup
      let emailAccount = null;
      let emailSetupStatus = 'not_setup';

      try {
        const existingAccount = await this.emailModel.getEmailAccountByUserId(user.id.toString());

        if (existingAccount) {
          emailAccount = {
            id: existingAccount.id,
            email: existingAccount.email,
            provider: existingAccount.provider,
            isActive: existingAccount.isActive
          };

          // Validate OAuth tokens if they exist
          if (existingAccount.accessToken && (existingAccount.provider === 'gmail' || existingAccount.provider === 'outlook')) {
            try {
              // Try to get valid access token (this will refresh if needed)
              await this.oauthService.getValidAccessToken(existingAccount);
              emailSetupStatus = 'connected';
            } catch (tokenError: any) {
              console.warn(`OAuth tokens for user ${user.email} need refresh:`, tokenError.message);
              emailSetupStatus = 'needs_reauth';
            }
          } else {
            emailSetupStatus = 'connected';
          }
        }
      } catch (emailError) {
        console.warn('Error checking email account during login:', emailError);
      }

      return ResponseHandler.success(res, { user, token, emailAccount, emailSetupStatus }, "Login Successfully");
    } catch (error) {
      console.error('Login error:', error);
      return ResponseHandler.internalError(res, 'Login Failed');
    }
  }

  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const tokenUser = req.user;
      if (!tokenUser) {
        return ResponseHandler.forbidden(res, 'User not authenticated');
      }

      const user = await this.authService.getProfile(tokenUser.id);
      if (!user) {
        return ResponseHandler.notFound(res, 'User not found');
      }

      return ResponseHandler.success(res, user);
    } catch (error) {
      console.error('Profile error:', error);
      return ResponseHandler.internalError(res, 'Failed to get profile');
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.forbidden(res, 'User not authenticated');
      }

      const { name, email } = req.body as any;
      const updates: any = {};

      if (name !== undefined) {
        if (!name.trim()) {
          return ResponseHandler.validationError(res, 'Name cannot be empty');
        }
        updates.name = name.trim();
      }

      if (email !== undefined) {
        if (!email.includes('@')) {
          return ResponseHandler.validationError(res, 'Please enter a valid email address');
        }
        updates.email = email.toLowerCase();
      }

      if (Object.keys(updates).length === 0) {
        return ResponseHandler.validationError(res, 'No valid updates provided');
      }

      const updatedUser = await this.authService.updateUser(req.user.id, updates);
      if (!updatedUser) {
        return ResponseHandler.notFound(res, 'User not found');
      }

      return ResponseHandler.success(res, updatedUser, "Profile Update Successfully");
    } catch (error) {
      console.error('Profile update error:', error);
      return ResponseHandler.internalError(res, 'Failed to update profile');
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, 'User not authenticated');
      }

      const { currentPassword, newPassword } = req.body as any;
      const success = await this.authService.changePassword(req.user.id, currentPassword, newPassword);

      if (!success) {
        return ResponseHandler.badRequest(res, 'Incorrect current password');
      }
      return ResponseHandler.success(res, null, 'Password updated successfully');
    } catch (error) {
      console.error('Password change error:', error);
      return ResponseHandler.internalError(res, 'Failed to change password');
    }
  }

  async changeAccountRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, 'User not authenticated');
      }

      const { role } = req.body as any;
      const success = await this.authService.changeAccountRole(req.user.id, role);

      if (!success) {
        return ResponseHandler.error(res, 'Failed to change account role');
      }
      return ResponseHandler.success(res, null, 'Account role updated successfully');
    } catch (error) {
      console.error('Account role change error:', error);
      return ResponseHandler.internalError(res, 'Failed to change account role');
    }
  }

  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body as any;

      if (!email || typeof email !== 'string') {
        return ResponseHandler.validationError(res, 'Valid email is required');
      }

      const success = await this.authService.forgotPassword(email);
      if (!success) {
        return ResponseHandler.error(res, 'Failed to initiate forgot password');
      }
      return ResponseHandler.success(res, null, 'Reset instructions sent successfully');
    } catch (error) {
      console.error('Forgot password error:', error);
      return ResponseHandler.internalError(res, 'Failed to initiate forgot password');
    }
  }

  async verifyOtp(req: Request, res: Response): Promise<void> {
    try {
      const { email, otp } = req.body as any;

      if (!email || typeof email !== 'string' || !otp) {
        return ResponseHandler.validationError(res, 'Valid email and OTP are required');
      }

      const verificationResult = await this.authService.verifyOtp(email, otp);

      if (verificationResult !== 'OTP verified') {
        let errorCode = ErrorCodes.VALIDATION_ERROR;
        if (verificationResult === 'OTP expired') errorCode = ErrorCodes.OTP_EXPIRED;
        else if (verificationResult === 'Invalid OTP') errorCode = ErrorCodes.OTP_INVALID;
        else if (verificationResult === 'OTP not found') errorCode = ErrorCodes.OTP_NOT_FOUND;

        return ResponseHandler.error(res, verificationResult, 400, errorCode);
      }
      return ResponseHandler.success(res, { valid: true }, 'OTP verified successfully');
    } catch (error) {
      console.error('Verify OTP error:', error);
      return ResponseHandler.internalError(res, 'Failed to verify OTP');
    }
  }

  async resetPassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      let { email, otp, newPassword } = req.body as any;

      if (!email && req.user) {
        email = req.user.email;
      }

      if (!email || typeof email !== 'string' || !otp || !newPassword) {
        return ResponseHandler.validationError(res, 'Valid email, OTP, and new password are required');
      }

      const success = await this.authService.resetPassword(email, otp, newPassword);

      if (!success) {
        return ResponseHandler.error(res, 'Failed to reset password. Invalid OTP or user not found.', 400);
      }
      return ResponseHandler.success(res, null, 'Password reset successfully');
    } catch (error) {
      console.error('Reset password error:', error);
      return ResponseHandler.internalError(res, 'Failed to reset password');
    }
  }

  async searchByPersonName(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        return ResponseHandler.unauthorized(res, 'User not authenticated');
      }

      const search = typeof req.query.search === 'string' ? req.query.search : '';
      const users = await this.authService.searchByPersonName(search);

      return ResponseHandler.success(res, users, "Successfully Searched");
    } catch (error) {
      console.error('Error searching users:', error);
      return ResponseHandler.internalError(res, 'Failed to search users');
    }
  }
}
