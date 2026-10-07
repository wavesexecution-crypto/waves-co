// TEMPORARY production DB diagnostic (read-only). Runs inside a Vercel
// production build AFTER `prisma generate`, using the build's DATABASE_URL.
// Prints schema truth only (no row data, no secrets, no writes).
// Removed after diagnosis.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const q = (sql) => prisma.$queryRawUnsafe(sql);
const show = async (label, sql) => {
  try {
    console.log(`=== PROD-DB-STATUS ${label} ===`);
    console.log(JSON.stringify(await q(sql)));
  } catch (e) {
    console.log(`=== PROD-DB-STATUS ${label} ERROR: ` + String(e && e.message || e).slice(0, 300));
  }
};
try {
  await show("role", `SELECT current_user`);
  await show("owners", `SELECT tablename, tableowner FROM pg_tables WHERE schemaname='public' AND tablename IN ('Tenant','User','AcquisitionEntitlement','AcquisitionOrder','LeadResearch','OutreachOrder','FollowUp','Notification') ORDER BY 1`);
  await show("ent_cols", `SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='AcquisitionEntitlement' ORDER BY ordinal_position`);
  await show("order_cols", `SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='AcquisitionOrder' ORDER BY ordinal_position`);
  await show("outreach_cols", `SELECT column_name FROM information_schema.columns WHERE table_name='OutreachOrder' ORDER BY ordinal_position`);
  await show("followup_cols", `SELECT column_name FROM information_schema.columns WHERE table_name='FollowUp' ORDER BY ordinal_position`);
  await show("lead_cols", `SELECT column_name FROM information_schema.columns WHERE table_name='LeadResearch' ORDER BY ordinal_position`);
  await show("user_cols", `SELECT column_name FROM information_schema.columns WHERE table_name='User' ORDER BY ordinal_position`);
  await show("poldefs", `SELECT c.relname AS t, p.polname AS name, p.polcmd AS cmd, pg_get_expr(p.polqual, p.polrelid) AS using, pg_get_expr(p.polwithcheck, p.polrelid) AS check FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relname IN ('AcquisitionEntitlement','AcquisitionOrder','OutreachOrder','LeadResearch','Notification','AuditLog','User','Tenant') ORDER BY 1,2`);
  await show("login_fn", `SELECT p.proname, r.rolname AS owner, p.prosecdef AS secdefiner, p.proconfig FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.proname='lookup_user_by_email'`);
} finally {
  await prisma.$disconnect();
  console.log("=== PROD-DB-STATUS done ===");
}
