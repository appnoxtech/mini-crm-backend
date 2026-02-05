-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'meeting',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'busy',
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "location" TEXT,
    "videoCallLink" TEXT,
    "createdBy" INTEGER NOT NULL,
    "assignedUserIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structured_knowledge_base" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "category_1_company_profile" JSONB,
    "category_2_products_services" JSONB,
    "category_3_sales_process" JSONB,
    "category_4_customers_markets" JSONB,
    "category_5_common_scenarios" JSONB,
    "category_6_communication" JSONB,
    "category_7_operations" JSONB,
    "category_8_resources" JSONB,
    "category_9_pricing" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "completion_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "structured_knowledge_base_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "structured_kb_versions" (
    "id" TEXT NOT NULL,
    "kb_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "full_kb_snapshot" JSONB NOT NULL,
    "changed_sections" JSONB NOT NULL,
    "changed_by" TEXT,
    "change_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "structured_kb_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "structured_kb_versions_kb_id_version_key" ON "structured_kb_versions"("kb_id", "version");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "email_drafts_user_trashed_idx" RENAME TO "email_drafts_userId_is_trashed_idx";
