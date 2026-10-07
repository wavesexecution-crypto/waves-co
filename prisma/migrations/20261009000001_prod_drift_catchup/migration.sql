-- Production drift catch-up (2026-10-08).
--
-- The production database was built from an older migration history, so a
-- handful of columns that exist in prisma/schema.prisma were never created
-- there (authenticated billing/acquisition routes returned 500 with
-- "column ... does not exist"). Every statement here is additive and guarded
-- with IF NOT EXISTS, so this migration is safe to run on databases that
-- already have some or all of these objects. No data is rewritten, no table
-- is dropped, no existing column changes meaning.
--
-- Types/defaults mirror schema.prisma exactly (including @map'ed snake_case
-- names where applicable). Nullable where the schema field is optional OR
-- where existing rows cannot be backfilled (old paid orders predate
-- leaseType/paymentId tracking; application code always writes these fields
-- for new rows, and integrity checks fail closed on legacy NULLs).

-- AcquisitionEntitlement: product/leaseType/pricePaise/currency/paymentId
ALTER TABLE "AcquisitionEntitlement" ADD COLUMN IF NOT EXISTS "product" TEXT NOT NULL DEFAULT 'acquisition_os';
ALTER TABLE "AcquisitionEntitlement" ADD COLUMN IF NOT EXISTS "leaseType" TEXT;
ALTER TABLE "AcquisitionEntitlement" ADD COLUMN IF NOT EXISTS "pricePaise" INTEGER;
ALTER TABLE "AcquisitionEntitlement" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "AcquisitionEntitlement" ADD COLUMN IF NOT EXISTS "paymentId" TEXT;

-- AcquisitionOrder: leaseType/providerOrderId/paymentId/signature
ALTER TABLE "AcquisitionOrder" ADD COLUMN IF NOT EXISTS "leaseType" TEXT;
ALTER TABLE "AcquisitionOrder" ADD COLUMN IF NOT EXISTS "providerOrderId" TEXT;
ALTER TABLE "AcquisitionOrder" ADD COLUMN IF NOT EXISTS "paymentId" TEXT;
ALTER TABLE "AcquisitionOrder" ADD COLUMN IF NOT EXISTS "signature" TEXT;

-- Single-trial guarantee + order idempotency at the database level.
-- Names are migration-specific so pre-existing equivalent constraints (if any)
-- do not conflict; duplicates would fail closed here for manual review.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'acquisitionentitlement_tenantid_catchup_uniq') THEN
    BEGIN
      ALTER TABLE "AcquisitionEntitlement" ADD CONSTRAINT acquisitionentitlement_tenantid_catchup_uniq UNIQUE ("tenantId");
    EXCEPTION WHEN duplicate_table THEN NULL;
    END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'acquisitionorder_providerorderid_catchup_uniq') THEN
    BEGIN
      ALTER TABLE "AcquisitionOrder" ADD CONSTRAINT acquisitionorder_providerorderid_catchup_uniq UNIQUE ("providerOrderId");
    EXCEPTION WHEN duplicate_table THEN NULL;
    END;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'acquisitionorder_idempotencykey_catchup_uniq') THEN
    BEGIN
      ALTER TABLE "AcquisitionOrder" ADD CONSTRAINT acquisitionorder_idempotencykey_catchup_uniq UNIQUE ("idempotencyKey");
    EXCEPTION WHEN duplicate_table THEN NULL;
    END;
  END IF;
END $$;
