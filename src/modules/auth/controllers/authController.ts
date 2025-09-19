import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { AuthenticatedRequest } from '../../../shared/types';
import { UserModel } from '../models/User';
import bcrypt from 'bcryptjs';

export class AuthController {
  private authService: AuthService;
  private userModel: UserModel;

  constructor(authService: AuthService, userModel: UserModel) {
    this.authService = authService;
    this.userModel = userModel;
  }

  async register(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, password, emailProvider, emailConfig } = req.body as any;

      if (!name || !email || !password) {
        res.status(400).json({ error: 'Missing required fields: name, email, password' });
        return;
      }

      // Check if user already exists
      const existingUser = this.userModel.findByEmail(email);
      if (existingUser) {
        res.status(400).json({ error: 'User already exists' });
        return;
      }

      // Create user using auth service
      const user = await this.authService.createUser(email, name, password);
      const token = this.authService.generateToken(user);

      // Auto-detect email provider from email domain
      let detectedProvider: 'gmail' | 'outlook' | 'custom' | null = null;
      const emailDomain = email.toLowerCase();
      
      if (emailDomain.includes('@gmail.com') || emailDomain.includes('@googlemail.com')) {
        detectedProvider = 'gmail';
      } else if (emailDomain.includes('@outlook.com') || emailDomain.includes('@hotmail.com') || emailDomain.includes('@live.com')) {
        detectedProvider = 'outlook';
      }

      // If email provider config is provided, set up email account automatically
      let emailAccount = null;
      if (emailProvider && emailConfig) {
        try {
          // This will be implemented in the email service
          console.log('Email account setup requested:', { email, provider: emailProvider });
        } catch (emailError) {
          console.warn('Email account setup failed:', emailError);
          // Don't fail registration if email setup fails
        }
      }

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        },
        token,
        emailAccount: emailAccount || null,
        detectedEmailProvider: detectedProvider // Send detected provider to frontend
      });
    } catch (error: any) {
      console.error('Registration failed:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      // Authenticate user
      const user = await this.authService.authenticateUser(email, password);
      if (!user) {
        res.status(401).json({ error: 'Invalid email or password' });
        return;
      }

      const token = this.authService.generateToken(user);

      // Check if user has email account setup
      let emailAccount = null;
      let emailSetupStatus = 'not_setup';
      
      try {
        // Import email service to check for existing email account
        const { EmailService } = require('../../email/services/emailService');
        const { EmailModel } = require('../../email/models/emailModel');
        const Database = require('better-sqlite3');
        
        const db = new Database('data.db');
        const emailModel = new EmailModel(db);
        const emailService = new EmailService(emailModel);
        
        const existingAccount = await emailService.getEmailAccountByUserId(user.id.toString());
        
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
              // Import OAuth service to validate tokens
              const { OAuthService } = require('../../email/services/oauthService');
              const oauthService = new OAuthService();
              
              // Try to get valid access token (this will refresh if needed)
              await oauthService.getValidAccessToken(existingAccount);
              emailSetupStatus = 'connected';
              
              console.log(`User ${user.email} has valid email account with ${existingAccount.provider}`);
            } catch (tokenError: any) {
              console.warn(`OAuth tokens for user ${user.email} need refresh:`, tokenError.message);
              emailSetupStatus = 'needs_reauth';
            }
          } else {
            emailSetupStatus = 'connected';
          }
        }
        
        db.close();
      } catch (emailError) {
        console.warn('Error checking email account during login:', emailError);
        // Don't fail login if email check fails
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt
        },
        token,
        emailAccount,
        emailSetupStatus
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      res.json({
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          createdAt: req.user.createdAt
        }
      });
    } catch (error) {
      console.error('Profile error:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { name, email } = req.body as any;
      const updates: Partial<{ name: string; email: string }> = {};

      if (name !== undefined) {
        if (!name.trim()) {
          res.status(400).json({ error: 'Name cannot be empty' });
          return;
        }
        updates.name = name.trim();
      }

      if (email !== undefined) {
        if (!email.includes('@')) {
          res.status(400).json({ error: 'Please enter a valid email address' });
          return;
        }
        updates.email = email.toLowerCase();
      }

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ error: 'No valid updates provided' });
        return;
      }

      const updatedUser = await this.authService.updateUser(req.user.id, updates);
      if (!updatedUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          createdAt: updatedUser.createdAt
        }
      });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
      }

      const { currentPassword, newPassword } = req.body as any;

      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: 'Current password and new password are required' });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters' });
        return;
      }

      const success = await this.authService.changePassword(req.user.id, currentPassword, newPassword);
      
      if (!success) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }
}
