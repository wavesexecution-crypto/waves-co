-- Acquisition OS is one complete product with no tiers.
-- Normalize any legacy tier values on Tenant.plan and fix the default.
-- Access is driven by AcquisitionEntitlement, never by Tenant.plan.

-- Normalize legacy tier strings to the single product value.
UPDATE "Tenant" SET "plan" = 'one' WHERE "plan" IN ('starter', 'free', 'growth', 'pro', 'enterprise', 'scale');

-- Fix the column default for future tenants.
ALTER TABLE "Tenant" ALTER COLUMN "plan" SET DEFAULT 'one';
