-- CreateTable
CREATE TABLE "companies" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "companyDomain" TEXT,
    "companyLogo" TEXT,
    "companyDescription" TEXT,
    "industry" TEXT,
    "companySize" TEXT,
    "companyLocation" TEXT,
    "companyWebsite" TEXT,
    "companySocialLinks" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "ownerUserId" INTEGER,
    "createdByUserId" INTEGER,
    "pricingTierId" INTEGER,
    "billingStatus" TEXT NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "settings" JSONB,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "profileImg" JSONB,
    "phone" TEXT,
    "role" TEXT DEFAULT 'user',
    "dateFormat" TEXT,
    "timezone" TEXT,
    "language" TEXT,
    "defaultCurrency" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otps" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_accounts" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "imapConfig" TEXT,
    "smtpConfig" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastHistoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "threadId" TEXT,
    "accountId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "from_address" TEXT NOT NULL,
    "to_addresses" JSONB NOT NULL,
    "cc_addresses" JSONB,
    "bcc_addresses" JSONB,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "htmlBody" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isIncoming" BOOLEAN NOT NULL DEFAULT true,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3),
    "contactIds" JSONB,
    "dealIds" JSONB,
    "accountEntityIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "labelIds" JSONB,
    "attachments" JSONB,
    "uid" INTEGER,
    "folder" TEXT,
    "providerId" TEXT,
    "snippet" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "lastClickedAt" TIMESTAMP(3),
    "lastOpenedAt" TIMESTAMP(3),
    "opens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_tracking_events" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_contents" (
    "messageId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "htmlBody" TEXT,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_contents_pkey" PRIMARY KEY ("messageId","companyId")
);

-- CreateTable
CREATE TABLE "thread_summaries" (
    "thread_id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "key_points" JSONB,
    "action_items" JSONB,
    "sentiment" TEXT,
    "participants" JSONB,
    "processing_time" INTEGER,
    "model_version" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "runpod_job_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_summarized_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thread_summaries_pkey" PRIMARY KEY ("thread_id")
);

-- CreateTable
CREATE TABLE "email_drafts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "to_recipients" JSONB NOT NULL,
    "cc_recipients" JSONB,
    "bcc_recipients" JSONB,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "html_body" TEXT,
    "attachments" JSONB,
    "reply_to_message_id" TEXT,
    "forward_from_message_id" TEXT,
    "thread_id" TEXT,
    "contact_ids" JSONB,
    "deal_ids" JSONB,
    "account_entity_ids" JSONB,
    "is_scheduled" BOOLEAN NOT NULL DEFAULT false,
    "scheduled_for" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "provider_id" TEXT,
    "remote_uid" TEXT,
    "from" TEXT,
    "is_trashed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "email_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "value" DOUBLE PRECISION,
    "stage" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_history" (
    "id" SERIAL NOT NULL,
    "leadId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipelines" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dealRotting" BOOLEAN NOT NULL DEFAULT false,
    "rottenDays" INTEGER NOT NULL DEFAULT 30,
    "ownerIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_stages" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "pipelineId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "rottenDays" INTEGER,
    "probability" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "value" DOUBLE PRECISION DEFAULT 0,
    "currency" TEXT DEFAULT 'USD',
    "pipelineId" INTEGER NOT NULL,
    "stageId" INTEGER NOT NULL,
    "email" JSONB,
    "phone" JSONB,
    "description" TEXT,
    "expectedCloseDate" TIMESTAMP(3),
    "actualCloseDate" TIMESTAMP(3),
    "probability" INTEGER NOT NULL DEFAULT 0,
    "userId" INTEGER NOT NULL,
    "assignedTo" INTEGER,
    "status" TEXT DEFAULT 'OPEN',
    "lostReason" TEXT,
    "lastActivityAt" TIMESTAMP(3),
    "isRotten" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "personId" INTEGER,
    "organizationId" INTEGER,
    "source" TEXT,
    "labelIds" JSONB,
    "customFields" JSONB,
    "ownerIds" JSONB,
    "isVisibleToAll" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_history" (
    "id" SERIAL NOT NULL,
    "dealId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "fromStageId" INTEGER,
    "toStageId" INTEGER,
    "stageDuration" DOUBLE PRECISION,
    "description" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "deal_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "dealId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION,
    "billingDate" TIMESTAMP(3),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labels" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "color" TEXT,
    "companyId" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "pipelineId" INTEGER,
    "userId" INTEGER,
    "organizationId" INTEGER,
    "personId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_activities" (
    "id" SERIAL NOT NULL,
    "dealId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "activityType" TEXT NOT NULL,
    "subject" TEXT,
    "label" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "priority" TEXT,
    "busyFree" TEXT,
    "note" TEXT,
    "organization" TEXT,
    "email" JSONB,
    "files" JSONB,
    "participants" JSONB,
    "deal" JSONB,
    "persons" JSONB,
    "mataData" JSONB,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organisations" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "industry" TEXT,
    "website" TEXT,
    "status" TEXT DEFAULT 'active',
    "emails" JSONB,
    "phones" JSONB,
    "annualRevenue" DOUBLE PRECISION,
    "numberOfEmployees" INTEGER,
    "linkedinProfile" TEXT,
    "address" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "organisations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "organizationId" INTEGER,
    "emails" JSONB,
    "phones" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_emails" (
    "id" SERIAL NOT NULL,
    "personId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "person_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_phones" (
    "id" SERIAL NOT NULL,
    "personId" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,

    CONSTRAINT "person_phones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "twilioCallSid" TEXT,
    "twilioAccountSid" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "status" TEXT NOT NULL DEFAULT 'initiated',
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT NOT NULL,
    "startTime" TIMESTAMP(3),
    "answerTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "duration" INTEGER NOT NULL DEFAULT 0,
    "ringDuration" INTEGER,
    "userId" INTEGER NOT NULL,
    "contactId" INTEGER,
    "dealId" INTEGER,
    "leadId" INTEGER,
    "disposition" TEXT,
    "notes" TEXT,
    "summary" TEXT,
    "queueName" TEXT,
    "assignedAgentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_participants" (
    "id" SERIAL NOT NULL,
    "callId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "participantSid" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'callee',
    "joinTime" TIMESTAMP(3),
    "leaveTime" TIMESTAMP(3),
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "hold" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_recordings" (
    "id" SERIAL NOT NULL,
    "callId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "recordingSid" TEXT,
    "recordingUrl" TEXT,
    "localFilePath" TEXT,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "fileSize" INTEGER,
    "channels" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "transcriptionSid" TEXT,
    "transcriptionText" TEXT,
    "transcriptionStatus" TEXT,
    "transcriptionUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sync_state" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "folder" TEXT NOT NULL,
    "lastSyncedUid" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_events" (
    "id" SERIAL NOT NULL,
    "callId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventData" TEXT,
    "triggeredBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "call_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imports" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "entityType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileFormat" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateHandling" TEXT NOT NULL DEFAULT 'skip',
    "mapping" JSONB,
    "filePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "errorSummary" TEXT,

    CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_errors" (
    "id" SERIAL NOT NULL,
    "importId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "columnName" TEXT,
    "value" TEXT,
    "errorType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_records" (
    "id" SERIAL NOT NULL,
    "importId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "entityId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_templates" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "mapping" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_staging" (
    "id" SERIAL NOT NULL,
    "importId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_staging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "isAllDay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_reminders" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "reminderMinutesBefore" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_shares" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "sharedWithUserId" INTEGER NOT NULL,
    "participantType" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_notifications" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "companyId" INTEGER NOT NULL,
    "reminderId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "userType" TEXT NOT NULL DEFAULT 'user',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "inAppSentAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "features" JSONB,
    "contractTerms" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_rules" (
    "id" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "conditions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_guidelines" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "tone" TEXT NOT NULL DEFAULT 'professional',
    "voiceCharacteristics" JSONB,
    "openingPhrases" JSONB,
    "closingPhrases" JSONB,
    "signatureTemplate" TEXT,
    "ctaPatterns" JSONB,
    "avoidPhrases" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_guidelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_base" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "keywords" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_base_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_profiles" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "dealId" INTEGER,
    "personId" INTEGER,
    "organizationId" INTEGER,
    "requirements" JSONB,
    "budgetMin" DOUBLE PRECISION,
    "budgetMax" DOUBLE PRECISION,
    "timeline" TEXT,
    "decisionMakers" JSONB,
    "objections" JSONB,
    "preferences" JSONB,
    "relationshipStage" TEXT,
    "maturityScore" DOUBLE PRECISION,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_suggestions" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
    "dealId" INTEGER,
    "personId" INTEGER,
    "subjectLine" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "htmlBody" TEXT,
    "emailType" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION,
    "reasoning" TEXT,
    "qualityScore" DOUBLE PRECISION,
    "issues" JSONB,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "userEdits" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "companyId" INTEGER NOT NULL,
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
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
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
    "companyId" INTEGER NOT NULL,
    "kb_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "full_kb_snapshot" JSONB NOT NULL,
    "changed_sections" JSONB NOT NULL,
    "changed_by" TEXT,
    "change_timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "structured_kb_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_companyDomain_key" ON "companies"("companyDomain");

-- CreateIndex
CREATE INDEX "companies_ownerUserId_idx" ON "companies"("ownerUserId");

-- CreateIndex
CREATE INDEX "companies_createdByUserId_idx" ON "companies"("createdByUserId");

-- CreateIndex
CREATE INDEX "companies_isActive_idx" ON "companies"("isActive");

-- CreateIndex
CREATE INDEX "companies_billingStatus_idx" ON "companies"("billingStatus");

-- CreateIndex
CREATE INDEX "companies_deletedAt_idx" ON "companies"("deletedAt");

-- CreateIndex
CREATE INDEX "companies_createdAt_idx" ON "companies"("createdAt");

-- CreateIndex
CREATE INDEX "companies_trialEndsAt_idx" ON "companies"("trialEndsAt");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE INDEX "companies_industry_idx" ON "companies"("industry");

-- CreateIndex
CREATE INDEX "companies_isActive_billingStatus_idx" ON "companies"("isActive", "billingStatus");

-- CreateIndex
CREATE INDEX "companies_isActive_deletedAt_idx" ON "companies"("isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "companies_ownerUserId_isActive_idx" ON "companies"("ownerUserId", "isActive");

-- CreateIndex
CREATE INDEX "companies_billingStatus_trialEndsAt_idx" ON "companies"("billingStatus", "trialEndsAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "emails_accountId_sentAt_idx" ON "emails"("accountId", "sentAt" DESC);

-- CreateIndex
CREATE INDEX "emails_companyId_idx" ON "emails"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "emails_messageId_accountId_key" ON "emails"("messageId", "accountId");

-- CreateIndex
CREATE INDEX "email_tracking_events_emailId_idx" ON "email_tracking_events"("emailId");

-- CreateIndex
CREATE INDEX "email_tracking_events_companyId_idx" ON "email_tracking_events"("companyId");

-- CreateIndex
CREATE INDEX "thread_summaries_companyId_idx" ON "thread_summaries"("companyId");

-- CreateIndex
CREATE INDEX "email_drafts_userId_idx" ON "email_drafts"("userId");

-- CreateIndex
CREATE INDEX "email_drafts_accountId_idx" ON "email_drafts"("accountId");

-- CreateIndex
CREATE INDEX "email_drafts_companyId_idx" ON "email_drafts"("companyId");

-- CreateIndex
CREATE INDEX "email_drafts_created_at_idx" ON "email_drafts"("created_at" DESC);

-- CreateIndex
CREATE INDEX "email_drafts_is_scheduled_scheduled_for_idx" ON "email_drafts"("is_scheduled", "scheduled_for");

-- CreateIndex
CREATE INDEX "email_drafts_is_trashed_idx" ON "email_drafts"("is_trashed");

-- CreateIndex
CREATE INDEX "email_drafts_userId_is_trashed_idx" ON "email_drafts"("userId", "is_trashed");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stages_pipelineId_orderIndex_key" ON "pipeline_stages"("pipelineId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "person_emails_email_key" ON "person_emails"("email");

-- CreateIndex
CREATE UNIQUE INDEX "person_phones_phone_key" ON "person_phones"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "calls_twilioCallSid_key" ON "calls"("twilioCallSid");

-- CreateIndex
CREATE INDEX "call_participants_companyId_idx" ON "call_participants"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "call_recordings_recordingSid_key" ON "call_recordings"("recordingSid");

-- CreateIndex
CREATE INDEX "call_recordings_companyId_idx" ON "call_recordings"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "email_sync_state_accountId_folder_companyId_key" ON "email_sync_state"("accountId", "folder", "companyId");

-- CreateIndex
CREATE INDEX "call_events_companyId_idx" ON "call_events"("companyId");

-- CreateIndex
CREATE INDEX "imports_companyId_idx" ON "imports"("companyId");

-- CreateIndex
CREATE INDEX "import_errors_companyId_idx" ON "import_errors"("companyId");

-- CreateIndex
CREATE INDEX "import_records_companyId_idx" ON "import_records"("companyId");

-- CreateIndex
CREATE INDEX "import_templates_companyId_idx" ON "import_templates"("companyId");

-- CreateIndex
CREATE INDEX "import_staging_companyId_idx" ON "import_staging"("companyId");

-- CreateIndex
CREATE INDEX "event_reminders_companyId_idx" ON "event_reminders"("companyId");

-- CreateIndex
CREATE INDEX "event_shares_companyId_idx" ON "event_shares"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "event_shares_eventId_sharedWithUserId_participantType_key" ON "event_shares"("eventId", "sharedWithUserId", "participantType");

-- CreateIndex
CREATE INDEX "event_notifications_companyId_idx" ON "event_notifications"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "event_notifications_eventId_reminderId_userId_userType_key" ON "event_notifications"("eventId", "reminderId", "userId", "userType");

-- CreateIndex
CREATE INDEX "knowledge_base_companyId_idx" ON "knowledge_base"("companyId");

-- CreateIndex
CREATE INDEX "client_profiles_companyId_idx" ON "client_profiles"("companyId");

-- CreateIndex
CREATE INDEX "email_suggestions_companyId_idx" ON "email_suggestions"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "structured_knowledge_base_companyId_key" ON "structured_knowledge_base"("companyId");

-- CreateIndex
CREATE INDEX "structured_kb_versions_companyId_idx" ON "structured_kb_versions"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "structured_kb_versions_kb_id_version_key" ON "structured_kb_versions"("kb_id", "version");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "email_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_messageId_companyId_fkey" FOREIGN KEY ("messageId", "companyId") REFERENCES "email_contents"("messageId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_tracking_events" ADD CONSTRAINT "email_tracking_events_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_tracking_events" ADD CONSTRAINT "email_tracking_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_contents" ADD CONSTRAINT "email_contents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thread_summaries" ADD CONSTRAINT "thread_summaries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "email_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_drafts" ADD CONSTRAINT "email_drafts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_history" ADD CONSTRAINT "lead_history_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_history" ADD CONSTRAINT "lead_history_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "pipeline_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_history" ADD CONSTRAINT "deal_history_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_history" ADD CONSTRAINT "deal_history_fromStageId_fkey" FOREIGN KEY ("fromStageId") REFERENCES "pipeline_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_history" ADD CONSTRAINT "deal_history_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES "pipeline_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_history" ADD CONSTRAINT "deal_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_history" ADD CONSTRAINT "deal_history_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_activities" ADD CONSTRAINT "deal_activities_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_activities" ADD CONSTRAINT "deal_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_activities" ADD CONSTRAINT "deal_activities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_emails" ADD CONSTRAINT "person_emails_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person_phones" ADD CONSTRAINT "person_phones_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_recordings" ADD CONSTRAINT "call_recordings_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_recordings" ADD CONSTRAINT "call_recordings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sync_state" ADD CONSTRAINT "email_sync_state_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_events" ADD CONSTRAINT "call_events_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_events" ADD CONSTRAINT "call_events_triggeredBy_fkey" FOREIGN KEY ("triggeredBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_events" ADD CONSTRAINT "call_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imports" ADD CONSTRAINT "imports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imports" ADD CONSTRAINT "imports_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_errors" ADD CONSTRAINT "import_errors_importId_fkey" FOREIGN KEY ("importId") REFERENCES "imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_errors" ADD CONSTRAINT "import_errors_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_records" ADD CONSTRAINT "import_records_importId_fkey" FOREIGN KEY ("importId") REFERENCES "imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_records" ADD CONSTRAINT "import_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_templates" ADD CONSTRAINT "import_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_staging" ADD CONSTRAINT "import_staging_importId_fkey" FOREIGN KEY ("importId") REFERENCES "imports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_staging" ADD CONSTRAINT "import_staging_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_reminders" ADD CONSTRAINT "event_reminders_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_reminders" ADD CONSTRAINT "event_reminders_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_shares" ADD CONSTRAINT "event_shares_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_shares" ADD CONSTRAINT "event_shares_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_notifications" ADD CONSTRAINT "event_notifications_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_notifications" ADD CONSTRAINT "event_notifications_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "event_reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_notifications" ADD CONSTRAINT "event_notifications_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_rules" ADD CONSTRAINT "discount_rules_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "pricing_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_suggestions" ADD CONSTRAINT "email_suggestions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structured_knowledge_base" ADD CONSTRAINT "structured_knowledge_base_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structured_kb_versions" ADD CONSTRAINT "structured_kb_versions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
