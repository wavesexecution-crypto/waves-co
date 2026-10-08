-- Acquisition Cycle OS tables (6-step loop) + cycle provenance columns.
--
-- All statements are additive and idempotent (IF NOT EXISTS / guarded DO
-- blocks). No data is rewritten, no table is dropped, no existing column
-- changes meaning. RLS follows the repo convention: ENABLE + FOR ALL policy
-- on app.tenant_id (Tenant rows keyed by id). The application connects as a
-- non-owner role, so these policies are enforced (FORCE unnecessary).

-- Cycle provenance on existing outreach rows (nullable: pre-cycle rows stay valid).
ALTER TABLE "OutreachOrder" ADD COLUMN IF NOT EXISTS "cycleId" TEXT;
ALTER TABLE "OutreachOrder" ADD COLUMN IF NOT EXISTS "templateVersion" INTEGER;
ALTER TABLE "OutreachOrder" ADD COLUMN IF NOT EXISTS "messageVariant" TEXT;
CREATE INDEX IF NOT EXISTS "OutreachOrder_tenant_cycle_idx" ON "OutreachOrder"("tenantId", "cycleId");

-- STEP 1: persistent Company Brain + revision history.
CREATE TABLE IF NOT EXISTS "CompanyBrain" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL UNIQUE,
  "source" TEXT NOT NULL DEFAULT 'intake',
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE IF NOT EXISTS "CompanyBrainRevision" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "brainId" TEXT NOT NULL REFERENCES "CompanyBrain"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CompanyBrain_tenant_status_idx" ON "CompanyBrain"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CompanyBrainRevision_tenant_brain_idx" ON "CompanyBrainRevision"("tenantId", "brainId", "version");

-- STEP 2..6 container + goals + templates.
CREATE TABLE IF NOT EXISTS "AcquisitionCycle" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "cycleNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "goalId" TEXT,
  "sendProvider" TEXT NOT NULL DEFAULT 'waves',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AcquisitionCycle_tenant_number_uniq" UNIQUE ("tenantId", "cycleNumber")
);
CREATE INDEX IF NOT EXISTS "AcquisitionCycle_tenant_status_idx" ON "AcquisitionCycle"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "CycleGoal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL REFERENCES "AcquisitionCycle"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "audience" TEXT,
  "segment" TEXT,
  "geography" TEXT,
  "companyTraits" JSONB,
  "qualification" JSONB,
  "exclusions" JSONB,
  "outcome" TEXT,
  "angle" TEXT,
  "constraints" JSONB,
  "status" TEXT NOT NULL DEFAULT 'active',
  "source" TEXT NOT NULL DEFAULT 'new',
  "sourceGoalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "CycleGoal_tenant_cycle_idx" ON "CycleGoal"("tenantId", "cycleId");

CREATE TABLE IF NOT EXISTS "MessageTemplate" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL REFERENCES "AcquisitionCycle"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL DEFAULT 1,
  "subject" TEXT NOT NULL,
  "opening" TEXT,
  "body" TEXT NOT NULL,
  "cta" TEXT,
  "structure" JSONB,
  "variants" JSONB,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "source" TEXT NOT NULL DEFAULT 'manual',
  "aiJobId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageTemplate_cycle_version_uniq" UNIQUE ("cycleId", "version")
);
CREATE INDEX IF NOT EXISTS "MessageTemplate_tenant_cycle_status_idx" ON "MessageTemplate"("tenantId", "cycleId", "status");

-- Async workers: AI jobs, n8n jobs, inbound n8n event log.
CREATE TABLE IF NOT EXISTS "AiJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "cycleId" TEXT REFERENCES "AcquisitionCycle"("id") ON DELETE SET NULL,
  "operation" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "inputRef" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "leaseClaimedAt" TIMESTAMP(3),
  "result" JSONB,
  "error" TEXT,
  "nextRetryAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "AiJob_tenant_status_retry_idx" ON "AiJob"("tenantId", "status", "nextRetryAt");

CREATE TABLE IF NOT EXISTS "N8nJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "cycleId" TEXT REFERENCES "AcquisitionCycle"("id") ON DELETE SET NULL,
  "event" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "result" JSONB,
  "lastError" TEXT,
  "nextRetryAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "N8nJob_tenant_status_retry_idx" ON "N8nJob"("tenantId", "status", "nextRetryAt");

CREATE TABLE IF NOT EXISTS "N8nEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL UNIQUE,
  "jobId" TEXT,
  "event" TEXT NOT NULL,
  "outcome" TEXT NOT NULL DEFAULT 'applied',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "N8nEvent_tenant_created_idx" ON "N8nEvent"("tenantId", "createdAt");

-- STEP 5: reply intelligence + direction.
CREATE TABLE IF NOT EXISTS "ReplyReport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "cycleId" TEXT REFERENCES "AcquisitionCycle"("id") ON DELETE SET NULL,
  "orderId" TEXT NOT NULL,
  "leadKey" TEXT,
  "prospectName" TEXT,
  "company" TEXT,
  "replyText" TEXT,
  "replyReceivedAt" TIMESTAMP(3),
  "replyStatus" TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
  "intent" TEXT NOT NULL DEFAULT 'Unknown',
  "sentiment" TEXT NOT NULL DEFAULT 'Unknown',
  "summary" TEXT,
  "signals" JSONB,
  "objections" JSONB,
  "askingFor" TEXT,
  "recommendedAction" TEXT,
  "recommendedDirection" TEXT,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "aiJobId" TEXT,
  "takenOverAt" TIMESTAMP(3),
  "takenOverBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReplyReport_tenant_order_uniq" UNIQUE ("tenantId", "orderId")
);
CREATE INDEX IF NOT EXISTS "ReplyReport_tenant_cycle_idx" ON "ReplyReport"("tenantId", "cycleId");

CREATE TABLE IF NOT EXISTS "ReplyDirection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "replyReportId" TEXT NOT NULL REFERENCES "ReplyReport"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "customText" TEXT,
  "draftResponse" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "ReplyDirection_tenant_report_idx" ON "ReplyDirection"("tenantId", "replyReportId");

-- STEP 6: immutable cycle report (exactly one per cycle; no update API).
CREATE TABLE IF NOT EXISTS "CycleReport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL UNIQUE REFERENCES "AcquisitionCycle"("id") ON DELETE CASCADE,
  "cycleNumber" INTEGER NOT NULL,
  "metrics" JSONB NOT NULL,
  "narrative" JSONB,
  "narrativeJobId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'final',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CycleReport_tenant_created_idx" ON "CycleReport"("tenantId", "createdAt");

-- Client-owned sending credential (encrypted at rest by the application).
CREATE TABLE IF NOT EXISTS "EmailCredential" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL UNIQUE,
  "provider" TEXT NOT NULL DEFAULT 'resend',
  "label" TEXT,
  "keyLast4" TEXT,
  "keyCipher" TEXT,
  "keyIv" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "EmailCredential_tenant_idx" ON "EmailCredential"("tenantId");

-- RLS for the new tenant tables (same convention as the rest of the app).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['CompanyBrain','CompanyBrainRevision','AcquisitionCycle','CycleGoal','MessageTemplate','AiJob','N8nJob','N8nEvent','ReplyReport','ReplyDirection','CycleReport','EmailCredential'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = lower(t) || '_tenant_scope') THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR ALL USING ("tenantId" = current_setting(%L, true)) WITH CHECK ("tenantId" = current_setting(%L, true))', lower(t) || '_tenant_scope', t, 'app.tenant_id', 'app.tenant_id');
    END IF;
  END LOOP;
END $$;
