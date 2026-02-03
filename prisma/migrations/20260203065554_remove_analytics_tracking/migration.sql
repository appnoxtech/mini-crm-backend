/*
  Warnings:

  - You are about to drop the column `enable_tracking` on the `email_drafts` table. All the data in the column will be lost.
  - You are about to drop the column `clicks` on the `emails` table. All the data in the column will be lost.
  - You are about to drop the column `opens` on the `emails` table. All the data in the column will be lost.
  - You are about to drop the column `trackingPixelId` on the `emails` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "email_drafts" DROP COLUMN "enable_tracking",
ADD COLUMN     "provider_id" TEXT,
ADD COLUMN     "remote_uid" TEXT;

-- AlterTable
ALTER TABLE "emails" DROP COLUMN "clicks",
DROP COLUMN "opens",
DROP COLUMN "trackingPixelId";

-- CreateIndex
CREATE INDEX "emails_accountId_sentAt_idx" ON "emails"("accountId", "sentAt" DESC);
