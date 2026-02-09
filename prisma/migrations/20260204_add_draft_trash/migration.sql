-- Add isTrashed field to EmailDraft table
ALTER TABLE "email_drafts" ADD COLUMN "is_trashed" BOOLEAN NOT NULL DEFAULT false;

-- Create index for better performance when filtering trashed drafts
CREATE INDEX "email_drafts_is_trashed_idx" ON "email_drafts"("is_trashed");
CREATE INDEX "email_drafts_user_trashed_idx" ON "email_drafts"("userId", "is_trashed");
