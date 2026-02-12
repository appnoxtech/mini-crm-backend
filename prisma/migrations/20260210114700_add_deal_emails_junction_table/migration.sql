/*
  Warnings:

  - You are about to drop the column `country` on the `persons` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "emailLastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "emailSyncStatus" TEXT DEFAULT 'not_synced',
ADD COLUMN     "linkedEmailsCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "emails" ADD COLUMN     "isLinkedToDeal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "persons" DROP COLUMN "country";

-- CreateTable
CREATE TABLE "deal_emails" (
    "id" SERIAL NOT NULL,
    "deal_id" INTEGER NOT NULL,
    "email_id" TEXT NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linked_method" TEXT NOT NULL,
    "confidence_score" INTEGER,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_by_user_id" INTEGER,
    "verified_at" TIMESTAMP(3),

    CONSTRAINT "deal_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_link_log" (
    "id" SERIAL NOT NULL,
    "operation_type" TEXT NOT NULL,
    "deals_processed" INTEGER NOT NULL DEFAULT 0,
    "links_created" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "triggered_by_user_id" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "email_link_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deal_emails_deal_id_idx" ON "deal_emails"("deal_id");

-- CreateIndex
CREATE INDEX "deal_emails_email_id_idx" ON "deal_emails"("email_id");

-- CreateIndex
CREATE INDEX "deal_emails_is_verified_idx" ON "deal_emails"("is_verified");

-- CreateIndex
CREATE INDEX "deal_emails_linked_method_idx" ON "deal_emails"("linked_method");

-- CreateIndex
CREATE UNIQUE INDEX "deal_emails_deal_id_email_id_key" ON "deal_emails"("deal_id", "email_id");

-- CreateIndex
CREATE INDEX "email_link_log_status_idx" ON "email_link_log"("status");

-- CreateIndex
CREATE INDEX "email_link_log_started_at_idx" ON "email_link_log"("started_at" DESC);

-- CreateIndex
CREATE INDEX "deals_emailSyncStatus_idx" ON "deals"("emailSyncStatus");

-- CreateIndex
CREATE INDEX "emails_isLinkedToDeal_idx" ON "emails"("isLinkedToDeal");

-- AddForeignKey
ALTER TABLE "deal_emails" ADD CONSTRAINT "deal_emails_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_emails" ADD CONSTRAINT "deal_emails_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_emails" ADD CONSTRAINT "deal_emails_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_link_log" ADD CONSTRAINT "email_link_log_triggered_by_user_id_fkey" FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
