-- Concurrency-safe outreach sending.
--
-- Problem: the previous send path did check-then-act on OutreachOrder.sendId.
-- Two concurrent requests could both observe sendId = NULL and both call the
-- email provider, delivering the same message twice to a real prospect.
--
-- Fix: an explicit claim column. A sender atomically moves sendClaimedAt from
-- NULL to now; only the row that wins that compare-and-set may call the
-- provider. sendId stays NULL until the provider actually accepts, so a
-- crashed or failed send releases the claim and stays retryable, and a stale
-- claim (process died mid-send) is reclaimable after the lease window.
--
-- Additive only: new nullable column + counter. No data is rewritten, no table
-- is dropped, no existing column changes meaning.

-- NOTE (2026-10-08): column name corrected to the Prisma-mapped
-- "send_claimed_at" (schema: sendClaimedAt @map("send_claimed_at")) before
-- this migration ever ran in production. "sendAttempts" has no @map.
ALTER TABLE "OutreachOrder" ADD COLUMN IF NOT EXISTS "send_claimed_at" TIMESTAMP(3);
ALTER TABLE "OutreachOrder" ADD COLUMN IF NOT EXISTS "sendAttempts" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "OutreachOrder_sendClaimedAt_idx" ON "OutreachOrder"("send_claimed_at");

-- Keep RLS intact and tenant-scoped for the new columns (the table already has
-- an ALL policy scoped to app.tenant_id; no new policy is required because RLS
-- is row-level, not column-level). Re-assert it so this migration is safe to
-- run on a database where the policy predates the acquisition tables.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'outreachorder_tenant_scope') THEN
    EXECUTE 'ALTER TABLE "OutreachOrder" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY outreachorder_tenant_scope ON "OutreachOrder" FOR ALL USING ("tenantId" = current_setting(''app.tenant_id'', true)) WITH CHECK ("tenantId" = current_setting(''app.tenant_id'', true))';
  END IF;
END $$;