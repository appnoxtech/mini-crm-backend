import { google } from 'googleapis';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { EmailAccount } from '../models/types';
import * as crypto from 'crypto';

export class OAuthService {
  private googleOAuth2Client: any;
  private msalClient: ConfidentialClientApplication | null;
  private encryptionKey: string;

  constructor() {
    // Initialize encryption key for token security
    this.encryptionKey = process.env.TOKEN_ENCRYPTION_KEY || 'default-key-change-in-production';

    // DEBUG: Log Env Vars to PM2 Logs
    console.log('--- OAuthService Config Check ---');
    console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'Present' : 'MISSING');
    console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'Present' : 'MISSING');
    console.log('GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI || 'MISSING');

    // Check if Google OAuth credentials are configured
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      console.warn('Google OAuth credentials not configured. Gmail OAuth will be disabled.');
      console.warn('Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables.');
      this.googleOAuth2Client = null;
    } else {
      // Initialize Google OAuth2 client
      this.googleOAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
    }

    // Initialize Microsoft MSAL client only if credentials are provided
    if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
      this.msalClient = new ConfidentialClientApplication({
        auth: {
          clientId: process.env.MICROSOFT_CLIENT_ID,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
          authority: 'https://login.microsoftonline.com/common'
        }
      });
    } else {
      console.warn('Microsoft OAuth credentials not configured. Outlook OAuth will be disabled.');
      this.msalClient = null;
    }
  }

  // Google OAuth Methods
  generateGoogleAuthUrl(userId: string): string {
    if (!this.googleOAuth2Client) {
      const missingVars = [];
      if (!process.env.GOOGLE_CLIENT_ID) missingVars.push('GOOGLE_CLIENT_ID');
      if (!process.env.GOOGLE_CLIENT_SECRET) missingVars.push('GOOGLE_CLIENT_SECRET');
      if (!process.env.GOOGLE_REDIRECT_URI) missingVars.push('GOOGLE_REDIRECT_URI');

      throw new Error(`Google OAuth is not configured. Missing environment variables: ${missingVars.join(', ')}. Please create a .env file with these variables. See README.md for setup instructions.`);
    }

    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    return this.googleOAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: userId // Pass userId in state for security
    });
  }

  async handleGoogleCallback(code: string, state: string): Promise<{
    accessToken: string;
    refreshToken: string;
    email: string;
    userId: string;
  }> {
    if (!this.googleOAuth2Client) {
      throw new Error('Google OAuth is not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI environment variables.');
    }

    try {
      const { tokens } = await this.googleOAuth2Client.getToken(code);

      // Get user info
      this.googleOAuth2Client.setCredentials(tokens);
      const gmail = google.gmail({ version: 'v1', auth: this.googleOAuth2Client });
      const profile = await gmail.users.getProfile({ userId: 'me' });

      return {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token!,
        email: profile.data.emailAddress!,
        userId: state
      };
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      throw new Error('Failed to complete Google OAuth');
    }
  }

  // Microsoft OAuth Methods
  async generateMicrosoftAuthUrl(userId: string): Promise<string> {
    if (!this.msalClient) {
      const missingVars = [];
      if (!process.env.MICROSOFT_CLIENT_ID) missingVars.push('MICROSOFT_CLIENT_ID');
      if (!process.env.MICROSOFT_CLIENT_SECRET) missingVars.push('MICROSOFT_CLIENT_SECRET');

      throw new Error(`Microsoft OAuth is not configured. Missing environment variables: ${missingVars.join(', ')}. Please create a .env file with these variables. See README.md for setup instructions.`);
    }

    const scopes = [
      'https://graph.microsoft.com/Mail.Send',
      'https://graph.microsoft.com/Mail.Read',
      'https://graph.microsoft.com/User.Read'
    ];

    const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
    if (!redirectUri) {
      throw new Error('MICROSOFT_REDIRECT_URI environment variable is not set');
    }

    return await this.msalClient.getAuthCodeUrl({
      scopes,
      redirectUri,
      state: userId
    });
  }

  async handleMicrosoftCallback(code: string, state: string): Promise<{
    accessToken: string;
    refreshToken: string;
    email: string;
    userId: string;
  }> {
    try {
      if (!this.msalClient) {
        throw new Error('Microsoft OAuth is not configured. Please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET environment variables.');
      }

      const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
      if (!redirectUri) {
        throw new Error('MICROSOFT_REDIRECT_URI environment variable is not set');
      }

      const result = await this.msalClient.acquireTokenByCode({
        code,
        scopes: [
          'https://graph.microsoft.com/Mail.Send',
          'https://graph.microsoft.com/Mail.Read',
          'https://graph.microsoft.com/User.Read'
        ],
        redirectUri
      });

      if (!result?.account?.username) {
        throw new Error('Failed to get user email from Microsoft');
      }

      // Note: MSAL doesn't return refresh tokens by default
      // We'll need to handle token refresh differently for Microsoft
      return {
        accessToken: result.accessToken!,
        refreshToken: '', // MSAL handles refresh internally
        email: result.account.username,
        userId: state
      };
    } catch (error) {
      console.error('Microsoft OAuth callback error:', error);
      throw new Error('Failed to complete Microsoft OAuth');
    }
  }

  // Token Refresh Methods
  async refreshGoogleToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
  }> {
    try {
      this.googleOAuth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await this.googleOAuth2Client.refreshAccessToken();

      return {
        accessToken: credentials.access_token!,
        refreshToken: credentials.refresh_token
      };
    } catch (error: any) {
      console.error('Google token refresh error:', error);

      // Check for specific error types
      if (error.response?.data?.error === 'invalid_grant') {
        throw new Error('Token has been expired or revoked. User needs to re-authorize their Gmail account.');
      } else if (error.message?.includes('invalid_grant')) {
        throw new Error('Token has been expired or revoked. User needs to re-authorize their Gmail account.');
      }

      throw new Error('Failed to refresh Google token');
    }
  }

  async refreshMicrosoftToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
  }> {
    try {
      if (!this.msalClient) {
        throw new Error('Microsoft OAuth is not configured. Please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET environment variables.');
      }

      const result = await this.msalClient.acquireTokenByRefreshToken({
        refreshToken,
        scopes: [
          'https://graph.microsoft.com/Mail.Send',
          'https://graph.microsoft.com/Mail.Read',
          'https://graph.microsoft.com/User.Read'
        ]
      });

      if (!result) {
        throw new Error('Failed to refresh Microsoft token');
      }

      return {
        accessToken: result.accessToken!
        // MSAL handles refresh internally, no need to return refreshToken
      };
    } catch (error) {
      console.error('Microsoft token refresh error:', error);
      throw new Error('Failed to refresh Microsoft token');
    }
  }

  // Helper method to create email account from OAuth tokens
  createEmailAccountFromOAuth(
    userId: string,
    email: string,
    provider: 'gmail' | 'outlook',
    accessToken: string,
    refreshToken: string
  ): EmailAccount {
    return {
      id: `${userId}-${email}-${Date.now()}`, // Add timestamp to ensure uniqueness
      userId: userId,
      email: email,
      provider: provider,
      accessToken: this.encryptToken(accessToken),
      refreshToken: this.encryptToken(refreshToken),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Token encryption for security
  public encryptToken(token: string): string {
    if (!token) return token;

    try {
      const iv = crypto.randomBytes(16);
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
      return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (error) {
      console.error('Token encryption failed:', error);
      return token; // Return unencrypted token as fallback
    }
  }

  decryptToken(encryptedToken: string): string {
    if (!encryptedToken || !encryptedToken.includes(':')) return encryptedToken;

    try {
      const parts = encryptedToken.split(':');
      if (parts.length !== 2 || !parts[0] || !parts[1]) return encryptedToken;

      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = Buffer.from(parts[1], 'hex');
      const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('Token decryption failed:', error);
      return encryptedToken; // Return encrypted token as fallback
    }
  }

  // Enhanced refresh methods with better error handling
  async refreshTokenIfNeeded(account: EmailAccount): Promise<{ accessToken: string; refreshToken?: string } | null> {
    if (!account.refreshToken) {
      throw new Error('No refresh token available for account');
    }

    try {
      const decryptedRefreshToken = this.decryptToken(account.refreshToken);

      if (account.provider === 'gmail') {
        return await this.refreshGoogleToken(decryptedRefreshToken);
      } else if (account.provider === 'outlook') {
        return await this.refreshMicrosoftToken(decryptedRefreshToken);
      }

      return null;
    } catch (error: any) {
      console.error(`Failed to refresh tokens for ${account.provider} account:`, error);

      // If refresh fails, provide specific error message
      if (error.message.includes('Token has been expired or revoked') ||
        error.message.includes('invalid_grant')) {
        throw new Error(`Your ${account.provider} account authorization has expired or been revoked. Please re-authenticate your account by going to the email setup page.`);
      }

      throw new Error(`Token refresh failed. User needs to re-authorize their ${account.provider} account.`);
    }
  }

  // Validate and refresh access token before use
  async getValidAccessToken(account: EmailAccount): Promise<string> {
    if (!account.accessToken) {
      throw new Error('No access token available');
    }

    const decryptedAccessToken = this.decryptToken(account.accessToken);

    // Always try to refresh the token to ensure it's valid
    // This is more reliable than trying to validate the token first
    try {
      console.log(`Validating and refreshing tokens for ${account.provider} account: ${account.email}`);

      const refreshResult = await this.refreshTokenIfNeeded(account);
      if (refreshResult) {
        console.log(`Successfully refreshed tokens for ${account.provider} account`);
        return refreshResult.accessToken;
      }

      // If no refresh was needed, return the current token
      return decryptedAccessToken;
    } catch (error: any) {
      console.error(`Failed to validate/refresh tokens for ${account.provider} account:`, error);
      throw new Error(`Unable to obtain valid access token: ${error.message}`);
    }
  }

  // Audit logging for security
  logOAuthActivity(userId: string, action: string, provider: string, success: boolean, details?: string): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId,
      action,
      provider,
      success,
      details,
      ip: 'unknown' // In production, you'd get this from the request
    };

    console.log('OAuth Activity:', JSON.stringify(logEntry));
    // In production, you'd store this in a secure audit log
  }
}
