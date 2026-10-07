-- Read-only verification of production tenant isolation.
--
-- Run with the APPLICATION role's pooled connection (DATABASE_URL), never with
-- an owner/superuser connection — RLS is bypassed for table owners, so checking
-- as the owner proves nothing.
--
-- Safe to run in production: it only SELECTs. No writes, no DDL, no locks.

\echo '=== 1. Which role is the application connecting as? ==='
SELECT current_user, session_user;

\echo ''
\echo '=== 2. Does that role own the tenant tables? (must be 0 rows) ==='
-- If the app role owns a table, RLS is silently bypassed for it and every
-- application-level tenant filter is the ONLY thing protecting data.
SELECT c.relname AS owned_table
FROM pg_class c
JOIN pg_roles r ON r.oid = c.relowner
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND r.rolname = current_user
  AND c.relkind = 'r'
  AND c.relname IN ('Tenant','User','AcquisitionProfile','AcquisitionEntitlement',
                    'AcquisitionOrder','OutreachOrder','OutreachEmail','FollowUp',
                    'LeadResearch','LeadLifecycleEvent','Notification',
                    'NotificationPreference','AuditLog','IdempotencyKey')
ORDER BY c.relname;

\echo ''
\echo '=== 3. RLS enabled + forced per critical table ==='
SELECT c.relname,
       c.relrowsecurity  AS rls_enabled,
       c.relforcerowsecurity AS rls_forced,
       COALESCE(p.policyname, '(none)') AS policy_name,
       COALESCE(p.cmd, '') AS applies_to
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relname IN ('AcquisitionEntitlement','AcquisitionOrder','OutreachOrder',
                    'OutreachEmail','Notification','AuditLog','User','Tenant')
ORDER BY c.relname;

\echo ''
\echo '=== 4. Migration bookkeeping (is _prisma_migrations current?) ==='
SELECT migration_name, finished_at IS NOT NULL AS applied,
       rolled_back_at IS NOT NULL AS rolled_back
FROM _prisma_migrations
ORDER BY finished_at DESC NULLS LAST
LIMIT 10;

\echo ''
\echo '=== 5. Does the new outreach send-claim column exist? ==='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'OutreachOrder'
  AND column_name IN ('sendClaimedAt','sendAttempts','sendId','status')
ORDER BY column_name;

\echo ''
\echo '=== 6. Operational counts per tenant (sanity, no data shown) ==='
SELECT t.slug,
       (SELECT COUNT(*) FROM "AcquisitionEntitlement" e WHERE e."tenantId" = t.id) AS entitlements,
       (SELECT COUNT(*) FROM "OutreachOrder"    o WHERE o."tenantId" = t.id) AS orders,
       (SELECT COUNT(*) FROM "Notification"    n WHERE n."tenantId" = t.id) AS notifications
FROM "Tenant" t
ORDER BY t.slug;