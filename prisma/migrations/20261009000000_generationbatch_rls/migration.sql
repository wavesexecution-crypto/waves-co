-- Tenant-scope the legacy GenerationBatch table.
--
-- Every other tenantId-bearing table received an ENABLE ROW LEVEL SECURITY +
-- FOR ALL tenant policy in 20260914000004; GenerationBatch was missed (it has
-- no application readers/writers, but defense-in-depth requires the same
-- boundary). Additive and idempotent: policy created only if absent. No data
-- is rewritten, no table is dropped.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'generationbatch_tenant_scope') THEN
    EXECUTE 'ALTER TABLE "GenerationBatch" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY generationbatch_tenant_scope ON "GenerationBatch" FOR ALL USING ("tenantId" = current_setting(''app.tenant_id'', true)) WITH CHECK ("tenantId" = current_setting(''app.tenant_id'', true))';
  END IF;
END $$;
