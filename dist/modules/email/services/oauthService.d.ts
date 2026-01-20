import { EmailAccount } from '../models/types';
export declare class OAuthService {
    private googleOAuth2Client;
    private msalClient;
    private encryptionKey;
    constructor();
    generateGoogleAuthUrl(userId: string): string;
    handleGoogleCallback(code: string, state: string): Promise<{
        accessToken: string;
        refreshToken: string;
        email: string;
        userId: string;
    }>;
    generateMicrosoftAuthUrl(userId: string): Promise<string>;
    handleMicrosoftCallback(code: string, state: string): Promise<{
        accessToken: string;
        refreshToken: string;
        email: string;
        userId: string;
    }>;
    refreshGoogleToken(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken?: string;
    }>;
    refreshMicrosoftToken(refreshToken: string): Promise<{
        accessToken: string;
        refreshToken?: string;
    }>;
    createEmailAccountFromOAuth(userId: string, email: string, provider: 'gmail' | 'outlook', accessToken: string, refreshToken: string): EmailAccount;
    encryptToken(token: string): string;
    decryptToken(encryptedToken: string): string;
    refreshTokenIfNeeded(account: EmailAccount): Promise<{
        accessToken: string;
        refreshToken?: string;
    } | null>;
    getValidAccessToken(account: EmailAccount): Promise<string>;
    logOAuthActivity(userId: string, action: string, provider: string, success: boolean, details?: string): void;
}
//# sourceMappingURL=oauthService.d.ts.map