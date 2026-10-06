-- Acquisition OS workflow tables (OS2 application slice).
-- Idempotent: safe to apply on databases that already have some tables.
-- Creates ONLY the workflow tables; existing auth/billing/notification tables untouched.


CREATE TABLE IF NOT EXISTS "Campaign" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "category" TEXT,
    "tier" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sendingLimit" INTEGER,
    "scheduledFor" TIMESTAMP(3),
    "eligibleSnapshot" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OutreachEmail" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "campaignId" TEXT,
    "leadKey" TEXT NOT NULL,
    "business" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvalId" TEXT,
    "messageId" TEXT,
    "error" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachEmail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FollowUp" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadKey" TEXT,
    "business" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "campaignId" TEXT,
    "outreachEmailId" TEXT,
    "outreachOrderId" TEXT,
    "follow_up_number" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeadResearch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadKey" TEXT NOT NULL,
    "engineLeadId" INTEGER,
    "business" TEXT NOT NULL,
    "category" TEXT,
    "area" TEXT,
    "city" TEXT,
    "website" TEXT,
    "instagram" TEXT,
    "rating" DOUBLE PRECISION,
    "reviews" INTEGER,
    "tier" TEXT,
    "leadScore" INTEGER,
    "digitalPresence" TEXT,
    "problem" TEXT,
    "opportunity" TEXT,
    "serviceFit" TEXT,
    "angleSeed" TEXT,
    "contactName" TEXT,
    "contactRole" TEXT,
    "email" TEXT,
    "sourceUrls" JSONB,
    "verification" TEXT,
    "notes" TEXT,
    "researchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadResearch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OutreachOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "leadKey" TEXT NOT NULL,
    "engineLeadId" INTEGER,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactRole" TEXT,
    "email" TEXT NOT NULL,
    "emailStatus" TEXT NOT NULL DEFAULT 'VERIFIED',
    "researchSnapshot" JSONB NOT NULL,
    "opportunity" TEXT,
    "outreachAngle" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "followupPlan" JSONB NOT NULL,
    "plannerModel" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'READY_FOR_APPROVAL',
    "approvalId" TEXT,
    "sendId" TEXT,
    "deliveryStatus" TEXT,
    "replyStatus" TEXT,
    "sendError" TEXT,
    "senderIdentity" TEXT,
    "ai_enabled" BOOLEAN NOT NULL DEFAULT false,
    "ai_model" TEXT,
    "enrichment_status" TEXT,
    "selected_service" TEXT,
    "personalization_context" JSONB,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeadLifecycleEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadKey" TEXT NOT NULL,
    "batchId" TEXT,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "enrichmentStatus" TEXT,
    "emailStatus" TEXT,
    "eligibility" TEXT,
    "orderId" TEXT,
    "approvalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadLifecycleEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ActivityEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "href" TEXT,
    "metadata" JSONB,
    "sourceKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcquisitionProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "companyName" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "whatWeSell" TEXT,
    "productsServices" JSONB,
    "locationsServed" JSONB,
    "businessModel" TEXT,
    "acquisitionObjective" TEXT,
    "primaryObjective" TEXT,
    "targetQuantity" INTEGER,
    "targetTimeframe" TEXT,
    "priorityProductService" TEXT,
    "icp" JSONB,
    "offer" JSONB,
    "brand" JSONB,
    "integrations" JSONB,
    "rules" JSONB,
    "readiness" JSONB,
    "activatedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcquisitionProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AcquisitionDataImport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "rowCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "summary" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcquisitionDataImport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Campaign_tenantId_status_idx" ON "Campaign"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "OutreachEmail_tenantId_status_idx" ON "OutreachEmail"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "OutreachEmail_tenantId_campaignId_idx" ON "OutreachEmail"("tenantId", "campaignId");
CREATE INDEX IF NOT EXISTS "OutreachEmail_tenantId_leadKey_idx" ON "OutreachEmail"("tenantId", "leadKey");
CREATE INDEX IF NOT EXISTS "FollowUp_tenantId_status_dueAt_idx" ON "FollowUp"("tenantId", "status", "dueAt");
CREATE INDEX IF NOT EXISTS "LeadResearch_tenantId_researchedAt_idx" ON "LeadResearch"("tenantId", "researchedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "LeadResearch_tenantId_leadKey_key" ON "LeadResearch"("tenantId", "leadKey");
CREATE INDEX IF NOT EXISTS "OutreachOrder_tenantId_status_idx" ON "OutreachOrder"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "OutreachOrder_tenantId_email_idx" ON "OutreachOrder"("tenantId", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "OutreachOrder_tenantId_leadKey_version_key" ON "OutreachOrder"("tenantId", "leadKey", "version");
CREATE INDEX IF NOT EXISTS "LeadLifecycleEvent_tenantId_leadKey_idx" ON "LeadLifecycleEvent"("tenantId", "leadKey");
CREATE INDEX IF NOT EXISTS "LeadLifecycleEvent_tenantId_stage_idx" ON "LeadLifecycleEvent"("tenantId", "stage");
CREATE INDEX IF NOT EXISTS "LeadLifecycleEvent_tenantId_createdAt_idx" ON "LeadLifecycleEvent"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadLifecycleEvent_batchId_idx" ON "LeadLifecycleEvent"("batchId");
CREATE INDEX IF NOT EXISTS "ActivityEvent_tenantId_createdAt_idx" ON "ActivityEvent"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityEvent_tenantId_sourceKey_idx" ON "ActivityEvent"("tenantId", "sourceKey");
CREATE UNIQUE INDEX IF NOT EXISTS "AcquisitionProfile_tenantId_key" ON "AcquisitionProfile"("tenantId");
CREATE INDEX IF NOT EXISTS "AcquisitionProfile_tenantId_status_idx" ON "AcquisitionProfile"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "AcquisitionDataImport_tenantId_profileId_idx" ON "AcquisitionDataImport"("tenantId", "profileId");
CREATE INDEX IF NOT EXISTS "AcquisitionDataImport_tenantId_status_idx" ON "AcquisitionDataImport"("tenantId", "status");

-- Foreign keys (guarded: skipped if already present).
DO $$ BEGIN
  ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_outreachOrderId_fkey" FOREIGN KEY ("outreachOrderId") REFERENCES "OutreachOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "LeadLifecycleEvent" ADD CONSTRAINT "LeadLifecycleEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OutreachOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "AcquisitionDataImport" ADD CONSTRAINT "AcquisitionDataImport_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "AcquisitionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
