import Database from 'better-sqlite3';

export class OtpModel {
    private db: Database.Database;

    constructor(db: Database.Database) {
        this.db = db;
    }

    initialize(): void {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS email_otps (
        email TEXT PRIMARY KEY,
        otp TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        createdAt TEXT NOT NULL
      )
    `);
    }

    saveOtp(email: string, otp: string, expiresAt: Date): void {
        const now = new Date().toISOString();
        const expires = expiresAt.toISOString();

        const stmt = this.db.prepare(`
      INSERT INTO email_otps (email, otp, expiresAt, createdAt)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        otp = excluded.otp,
        expiresAt = excluded.expiresAt,
        createdAt = excluded.createdAt
    `);

        stmt.run(email.toLowerCase(), otp, expires, now);
    }

    getOtp(email: string): { otp: string; expiresAt: string } | undefined {
        const stmt = this.db.prepare('SELECT otp, expiresAt FROM email_otps WHERE email = ?');
        return stmt.get(email.toLowerCase()) as { otp: string; expiresAt: string } | undefined;
    }

    deleteOtp(email: string): void {
        const stmt = this.db.prepare('DELETE FROM email_otps WHERE email = ?');
        stmt.run(email.toLowerCase());
    }

    // Cleanup expired OTPs (can be called periodically)
    cleanupExpired(): void {
        const now = new Date().toISOString();
        this.db.exec(`DELETE FROM email_otps WHERE expiresAt < '${now}'`);
    }
}
