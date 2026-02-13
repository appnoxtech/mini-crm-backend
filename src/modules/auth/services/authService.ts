import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, AuthUser } from '../../../shared/types';
import { UserModel } from '../models/User';
import { OtpModel } from '../models/Otp';
import { EmailService } from '../../email/services/emailService';
import { PersonModel } from '../../management/persons/models/Person';
import { SystemEmailHelper } from '../../../shared/utils/SystemEmailHelper';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const SALT_ROUNDS = 10;

export class AuthService {
  private userModel: UserModel;
  private otpModel: OtpModel;
  private emailService: EmailService;
  private personModel: PersonModel;

  constructor(userModel: UserModel, otpModel: OtpModel, emailService: EmailService, personModel: PersonModel) {
    this.userModel = userModel;
    this.otpModel = otpModel;
    this.emailService = emailService;
    this.personModel = personModel;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateToken(user: AuthUser): string {
    return jwt.sign(
      {
        id: user.id,
        companyId: user.companyId,
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
  }

  verifyToken(token: string): AuthUser | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  async createUser(email: string, name: string, password: string, phone: string, role: string = 'user', companyId: number): Promise<AuthUser> {
    const passwordHash = await this.hashPassword(password);
    const user = await this.userModel.createUser(email, name, passwordHash, phone, role, companyId);

    return {
      id: user.id,
      companyId: user.companyId,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt
    };
  }

  async authenticateUser(email: string, password: string): Promise<AuthUser | null> {
    try {
      const user = await this.userModel.findByEmail(email);
      if (!user) {
        return null;
      }

      const isValid = await this.comparePassword(password, user.passwordHash);
      if (!isValid) {
        return null;
      }
      const { passwordHash, ...safeUser } = user;
      return safeUser as unknown as AuthUser;
    } catch (error) {
      console.error('Authentication error:', error);
      return null;
    }
  }

  async getProfile(id: number, companyId: number): Promise<AuthUser | null> {
    const user = await this.userModel.findById(id, companyId);
    if (!user) return null;

    return {
      ...user
    } as unknown as AuthUser;
  }

  async updateUser(id: number, companyId: number, updates: Partial<{ name: string; email: string }>): Promise<AuthUser | null> {
    const user = await this.userModel.updateUser(id, companyId, updates as any);
    if (!user) return null;

    return {
      ...user
    } as unknown as AuthUser;
  }

  async changePassword(id: number, companyId: number, currentPassword: string, newPassword: string): Promise<boolean> {
    try {
      const user = await this.userModel.findById(id, companyId);
      if (!user) {
        return false;
      }

      const isValid = await this.comparePassword(currentPassword, user.passwordHash);
      if (!isValid) {
        return false;
      }

      const newPasswordHash = await this.hashPassword(newPassword);
      return await this.userModel.updatePassword(id, companyId, newPasswordHash);
    } catch (error) {
      console.error('Password change error:', error);
      return false;
    }
  }

  async changeAccountRole(id: number, role: string, companyId: number): Promise<boolean> {
    try {
      return await this.userModel.updateAccountRole(id, role, companyId);
    } catch (error) {
      console.error('Account role change error:', error);
      return false;
    }
  }

  async searchByPersonName(searchTerm: string, companyId: number): Promise<any> {
    if (!searchTerm || !searchTerm.trim()) {
      return [];
    }

    const trimmedSearch = searchTerm.trim();

    // Search in users table
    const users = await this.userModel.searchByPersonName(trimmedSearch, companyId);
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      type: 'user',
      profileImg: user.profileImg
    }));

    // Search in persons table
    const persons = await this.personModel.searchByPersonName(trimmedSearch, companyId);
    const formattedPersons = persons.map((person: any) => ({
      id: person.id,
      name: `${person.firstName} ${person.lastName || ''}`.trim(),
      email: person.emails?.[0]?.email || '',
      type: 'person',
      profileImg: [] // Persons don't have profileImg in this schema yet
    }));

    return [...formattedUsers, ...formattedPersons];
  }

  // async forgotPassword(email: string): Promise<boolean> {
  //   try {
  //     const user = this.userModel.findByEmail(email);
  //     if (!user) {
  //       return false;
  //     }

  //     // Generate 6 digit OTP
  //     const otp = Math.floor(100000 + Math.random() * 900000).toString();
  //     // Expires in 10 minutes
  //     const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  //     // Hash OTP before saving
  //     const hashedOtp = await bcrypt.hash(otp, 10);
  //     this.otpModel.saveOtp(email, hashedOtp, expiresAt);

  //     // Create a temporary system account from .env
  //     const systemAccount: any = {
  //       id: 'system',
  //       userId: 'system',
  //       email: process.env.SMTP_USER || 'system@appnox.ai',
  //       provider: 'custom',
  //       isActive: true,
  //       smtpConfig: {
  //         host: process.env.SMTP_HOST || 'smtp.gmail.com',
  //         port: parseInt(process.env.SMTP_PORT || '587'),
  //         secure: process.env.SMTP_SECURE === 'true',
  //         username: process.env.SMTP_USER || '',
  //         password: process.env.SMTP_PASS || ''
  //       }
  //     };

  //     // Send email using system configuration with skipSave option
  //     await this.emailService.sendEmail(systemAccount, {
  //       to: [email],
  //       subject: 'Reset Your Password - OTP',
  //       body: `Your OTP to reset password is: ${otp}. It expires in 10 minutes.`,
  //       htmlBody: this.generateOtpTemplate(otp)
  //     }, { skipSave: true });

  //     return true;
  //   } catch (error) {
  //     console.error('Forgot password error:', error);
  //     return false;
  //   }
  // }

  // private generateOtpTemplate(otp: string): string {
  //   return `
  //     <!DOCTYPE html>
  //     <html>
  //     <head>
  //       <meta charset="utf-8">
  //       <style>
  //         body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
  //         .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px; }
  //         .header { text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eee; }
  //         .content { padding: 30px 20px; text-align: center; background-color: #ffffff; border-radius: 8px; margin-top: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
  //         .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4F46E5; margin: 20px 0; padding: 15px; background-color: #f0fdf4; border-radius: 8px; display: inline-block; }
  //         .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #888; }
  //       </style>
  //     </head>
  //     <body>
  //       <div class="container">
  //         <div class="header">
  //           <h2>Mini CRM Security</h2>
  //         </div>
  //         <div class="content">
  //           <p>Hello,</p>
  //           <p>You requested to reset your password. Please use the following One-Time Password (OTP) to proceed:</p>

  //           <div class="otp-code">${otp}</div>

  //           <p>This code is valid for <strong>10 minutes</strong>.</p>
  //           <p>If you did not request this, please ignore this email.</p>
  //         </div>
  //         <div class="footer">
  //           <p>&copy; ${new Date().getFullYear()} Mini CRM. All rights reserved.</p>
  //         </div>
  //       </div>
  //     </body>
  //     </html>
  //   `;
  // }

  // async verifyOtp(email: string, otp: string, shouldDelete: boolean = false): Promise<string> {
  //   try {
  //     const otpRecord = this.otpModel.getOtp(email);
  //     if (!otpRecord) return "OTP not found";

  //     // Compare hashed OTP
  //     const isMatch = await bcrypt.compare(otp, otpRecord.otp);
  //     if (!isMatch) return "Invalid OTP";

  //     const now = new Date();
  //     const expires = new Date(otpRecord.expiresAt);
  //     // give a message if otp is expired
  //     if (now > expires) {
  //       return "OTP expired";
  //     }

  //     if (shouldDelete) {
  //       this.otpModel.deleteOtp(email);
  //     }

  //     return "OTP verified";
  //   } catch (error) {
  //     console.error('Verify OTP error:', error);
  //     return "OTP verification failed";
  //   }
  // }

  // async resetPassword(email: string, otp: string, newPassword: string): Promise<boolean> {
  //   try {
  //     // Verify OTP and consume it (delete it)
  //     const verificationResult = await this.verifyOtp(email, otp, true);

  //     if (verificationResult !== "OTP verified") {
  //       return false;
  //     }

  //     const user = this.userModel.findByEmail(email);
  //     if (!user) return false;

  //     const newPasswordHash = await this.hashPassword(newPassword);
  //     const updated = this.userModel.updatePassword(user.id, newPasswordHash);

  //     // OTP is already deleted by verifyOtp(..., true)

  //     return updated;
  //   } catch (error) {
  //     console.error('Reset password error:', error);
  //     return false;
  //   }
  // }

  async forgotPassword(email: string): Promise<boolean> {
    try {
      const user = await this.userModel.findByEmail(email);
      if (!user) {
        return false;
      }

      // Generate 6 digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      // Expires in 10 minutes
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);



      // ...

      // Hash OTP before saving
      const hashedOtp = await bcrypt.hash(otp, 10);
      await this.otpModel.saveOtp(email, hashedOtp, expiresAt);

      // Send email using SystemEmailHelper
      // This uses the explicit "sendViaSystemSmtp" logic as requested
      const emailSent = await SystemEmailHelper.sendViaSystemSmtp(
        email,
        'Reset Your Password - OTP',
        `Your OTP to reset password is: ${otp}. It expires in 10 minutes.`,
        this.generateOtpTemplate(otp)
      );

      if (!emailSent) {
        console.error('Failed to send OTP email');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Forgot password error:', error);
      return false;
    }
  }

  private generateOtpTemplate(otp: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px; }
          .header { text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eee; }
          .content { padding: 30px 20px; text-align: center; background-color: #ffffff; border-radius: 8px; margin-top: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
          .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4F46E5; margin: 20px 0; padding: 15px; background-color: #f0fdf4; border-radius: 8px; display: inline-block; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #888; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Mini CRM Security</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>You requested to reset your password. Please use the following One-Time Password (OTP) to proceed:</p>
            
            <div class="otp-code">${otp}</div>
            
            <p>This code is valid for <strong>10 minutes</strong>.</p>
            <p>If you did not request this, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Mini CRM. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async verifyOtp(email: string, otp: string, shouldDelete: boolean = false): Promise<string> {
    try {
      const otpRecord = await this.otpModel.getOtp(email);
      if (!otpRecord) return "OTP not found";

      // Compare hashed OTP
      const isMatch = await bcrypt.compare(otp, otpRecord.otp);
      if (!isMatch) return "Invalid OTP";

      const now = new Date();
      const expires = new Date(otpRecord.expiresAt);
      // give a message if otp is expired
      if (now > expires) {
        return "OTP expired";
      }

      if (shouldDelete) {
        await this.otpModel.deleteOtp(email);
      }

      return "OTP verified";
    } catch (error) {
      console.error('Verify OTP error:', error);
      return "OTP verification failed";
    }
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<boolean> {
    try {
      // Verify OTP and consume it (delete it)
      const verificationResult = await this.verifyOtp(email, otp, true);

      if (verificationResult !== "OTP verified") {
        return false;
      }

      const user = await this.userModel.findByEmail(email);
      if (!user) return false;

      const newPasswordHash = await this.hashPassword(newPassword);
      const updated = await this.userModel.updatePassword(user.id, user.companyId, newPasswordHash);

      // OTP is already deleted by verifyOtp(..., true)

      return updated;
    } catch (error) {
      console.error('Reset password error:', error);
      return false;
    }
  }
}

// Export individual functions for backward compatibility
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      companyId: user.companyId,
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    return decoded;
  } catch (error) {
    return null;
  }
}

