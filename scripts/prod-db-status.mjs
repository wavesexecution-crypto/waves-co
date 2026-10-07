// TEMPORARY production DB diagnostic (read-only). Runs inside a Vercel
// production build where DATABASE_URL/DIRECT_URL exist. Prints schema truth
// (table/column presence, applied migrations, RLS/FORCE flags). No secrets,
// no data rows, no writes. Removed after diagnosis.
import { execSync } from "node:child_process";

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 90000 });
  } catch (e) {
    return `EXIT_NONZERO: ${(e.stdout || "")}\n${(e.stderr || "").slice(0, 2000)}`;
  }
}

console.log("=== PROD-DB-STATUS migrate status ===");
console.log(sh("pnpm exec prisma migrate status"));

const sql = `
SELECT 'TABLES:' || string_agg(tablename, ',' ORDER BY tablename)
FROM pg_tables WHERE schemaname='public' AND tablename IN
('Tenant','User','AcquisitionEntitlement','AcquisitionOrder','LeadResearch','OutreachOrder','OutreachEmail','FollowUp','LeadLifecycleEvent','AcquisitionProfile','Notification','AuditLog','GenerationBatch','VerificationToken','_prisma_migrations');
SELECT 'MIGRATIONS_APPLIED:' || COALESCE(string_agg(migration_name, ',' ORDER BY migration_name), '(none)');
SELECT 'ENT_COLS:' || string_agg(column_name, ',' ORDER BY ordinal_position)
FROM information_schema.columns WHERE table_name='AcquisitionEntitlement';
SELECT 'ORDER_COLS_HAS_SENDCLAIM:' || count(*)::text
FROM information_schema.columns WHERE table_name='OutreachOrder' AND column_name IN ('sendClaimedAt','sendAttempts');
SELECT 'RLS_FORCED_TABLES:' || COALESCE(string_agg(relname, ','), '(none)')
FROM pg_class WHERE relnamespace='public'::regnamespace AND relforcerowsecurity;
SELECT 'RLS_ENABLED_NO_FORCE:' || count(*)::text
FROM pg_class WHERE relnamespace='public'::regnamespace AND relrowsecurity AND NOT relforcerowsecurity AND relkind='r';
`;
console.log("=== PROD-DB-STATUS schema probe ===");
const fs = await import("node:fs");
fs.writeFileSync("/tmp/probe.sql", sql);
console.log(sh("pnpm exec prisma db execute --stdin < /tmp/probe.sql"));
console.log("=== PROD-DB-STATUS done ===");
