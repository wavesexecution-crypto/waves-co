-- AuditLog tenant scope + RLS
-- This migration enforces tenant isolation on AuditLog and other tenant-scoped tables.
-- It must be applied after all existing migrations.

-- 1) Ensure a system tenant exists for orphaned audit records
--    (tenantId = 'system' is reserved for platform-level audit entries)
DO $$ BEGIN
  INSERT INTO "Tenant" (id, name, slug, plan, status, "createdAt", "updatedAt")
  VALUES ('system', 'WAVES System', 'system', 'one', 'active', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
END $$;

-- 2) Backfill NULL tenantId in AuditLog to 'system' tenant
--    This preserves historical audit records while enforcing NOT NULL going forward.
--    Only runs if NULL records exist.
UPDATE "AuditLog"
SET "tenantId" = 'system'
WHERE "tenantId" IS NULL;

-- 3) Enforce NOT NULL on tenantId (now safe after backfill)
ALTER TABLE "AuditLog" ALTER COLUMN "tenantId" SET NOT NULL;

-- 4) Enable RLS on AuditLog
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

-- 5) RLS Policies for AuditLog
--    INSERT: only allow rows where tenantId = current_setting('app.tenant_id')
--    This matches the withTenantContext() contract which sets SET LOCAL app.tenant_id
CREATE POLICY auditlog_insert_tenant_scope ON "AuditLog"
  FOR INSERT
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

--    SELECT: only allow rows where tenantId = current_setting('app.tenant_id')
CREATE POLICY auditlog_select_tenant_scope ON "AuditLog"
  FOR SELECT
  USING ("tenantId" = current_setting('app.tenant_id', true));

--    UPDATE: only allow updates to rows owned by the current tenant
CREATE POLICY auditlog_update_tenant_scope ON "AuditLog"
  FOR UPDATE
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

--    DELETE: only allow deletes of rows owned by the current tenant
--    (AuditLog should be append-only in practice, but policy exists for completeness)
CREATE POLICY auditlog_delete_tenant_scope ON "AuditLog"
  FOR DELETE
  USING ("tenantId" = current_setting('app.tenant_id', true));

-- 6) Enable RLS + Policies on other tenant-scoped tables
--    These tables already have tenantId NOT NULL and FK to Tenant.
--    We add policies that mirror the AuditLog contract.

-- Notification
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_tenant_scope ON "Notification"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- NotificationPreference
ALTER TABLE "NotificationPreference" ENABLE ROW LEVEL SECURITY;
CREATE POLICY notificationpref_tenant_scope ON "NotificationPreference"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Acquisition OS workflow tables
ALTER TABLE "Campaign" ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaign_tenant_scope ON "Campaign"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "OutreachEmail" ENABLE ROW LEVEL SECURITY;
CREATE POLICY outreach_email_tenant_scope ON "OutreachEmail"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "FollowUp" ENABLE ROW LEVEL SECURITY;
CREATE POLICY followup_tenant_scope ON "FollowUp"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "LeadResearch" ENABLE ROW LEVEL SECURITY;
CREATE POLICY leadresearch_tenant_scope ON "LeadResearch"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "OutreachOrder" ENABLE ROW LEVEL SECURITY;
CREATE POLICY outreachorder_tenant_scope ON "OutreachOrder"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "LeadLifecycleEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY leadlifecycle_tenant_scope ON "LeadLifecycleEvent"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "ActivityEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY activityevent_tenant_scope ON "ActivityEvent"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "AcquisitionProfile" ENABLE ROW LEVEL SECURITY;
CREATE POLICY acquisitionprofile_tenant_scope ON "AcquisitionProfile"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "AcquisitionDataImport" ENABLE ROW LEVEL SECURITY;
CREATE POLICY acquisitiondataimport_tenant_scope ON "AcquisitionDataImport"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Billing / Entitlement tables
ALTER TABLE "AcquisitionEntitlement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY acquisitionentitlement_tenant_scope ON "AcquisitionEntitlement"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "AcquisitionOrder" ENABLE ROW LEVEL SECURITY;
CREATE POLICY acquisitionorder_tenant_scope ON "AcquisitionOrder"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Client OS tables
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
CREATE POLICY client_tenant_scope ON "Client"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "OnboardingStep" ENABLE ROW LEVEL SECURITY;
CREATE POLICY onboardingstep_tenant_scope ON "OnboardingStep"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_tenant_scope ON "Project"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "ProjectTask" ENABLE ROW LEVEL SECURITY;
CREATE POLICY projecttask_tenant_scope ON "ProjectTask"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "Deliverable" ENABLE ROW LEVEL SECURITY;
CREATE POLICY deliverable_tenant_scope ON "Deliverable"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Automation OS
ALTER TABLE "IntegrationStatus" ENABLE ROW LEVEL SECURITY;
CREATE POLICY integrationstatus_tenant_scope ON "IntegrationStatus"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- AI Gateway
ALTER TABLE "ClientAiConfig" ENABLE ROW LEVEL SECURITY;
CREATE POLICY clientaiconfig_tenant_scope ON "ClientAiConfig"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

ALTER TABLE "AiUsageLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_usagelog_tenant_scope ON "AiUsageLog"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Cross-site handoff
ALTER TABLE "WavesHandoffToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY waveshandoff_tenant_scope ON "WavesHandoffToken"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Idempotency keys
ALTER TABLE "IdempotencyKey" ENABLE ROW LEVEL SECURITY;
CREATE POLICY idempotency_tenant_scope ON "IdempotencyKey"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- Refresh tokens
ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY refreshtoken_tenant_scope ON "RefreshToken"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- TenantModule
ALTER TABLE "TenantModule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenantmodule_tenant_scope ON "TenantModule"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- User (tenant-scoped via tenantId FK)
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_tenant_scope ON "User"
  FOR ALL
  USING ("tenantId" = current_setting('app.tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.tenant_id', true));

-- 7) Platform bypass: SECURITY DEFINER function for cross-tenant admin operations
--    This function allows explicit platform-level operations (e.g., system tenant, admin)
--    without weakening the default RLS policies.
CREATE OR REPLACE FUNCTION platform_bypass(allowed boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF allowed THEN
    -- Platform operations explicitly opt in by setting a session variable
    -- This is ONLY used by controlled platform scripts, never by application code
    PERFORM set_config('app.platform_bypass', 'true', false);
  ELSE
    PERFORM set_config('app.platform_bypass', 'false', false);
  END IF;
END $$;

-- Note: The platform bypass is NOT added to the RLS policies above.
-- If platform operations need cross-tenant access, they must use the SECURITY DEFINER
-- function `lookup_user_by_email()` which already exists and bypasses RLS,
-- or create new SECURITY DEFINER functions for specific admin operations.
-- This keeps the default deny-all-except-tenant isolation intact.