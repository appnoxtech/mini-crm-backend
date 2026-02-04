-- AlterTable
ALTER TABLE "email_drafts" ADD COLUMN     "from" TEXT;

-- AlterTable
ALTER TABLE "emails" ADD COLUMN     "clicks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastClickedAt" TIMESTAMP(3),
ADD COLUMN     "lastOpenedAt" TIMESTAMP(3),
ADD COLUMN     "opens" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "email_tracking_events" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_tracking_events_emailId_idx" ON "email_tracking_events"("emailId");

-- AddForeignKey
ALTER TABLE "email_tracking_events" ADD CONSTRAINT "email_tracking_events_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;
