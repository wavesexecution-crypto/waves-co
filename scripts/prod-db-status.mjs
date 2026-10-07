// TEMPORARY production DB diagnostic (read-only). Runs inside a Vercel
// production build AFTER `prisma generate`, using the build's DATABASE_URL.
// Prints schema truth only (no row data, no secrets, no writes).
// Removed after diagnosis.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const q = (sql) => prisma.$queryRawUnsafe(sql);
try {
  console.log("=== PROD-DB-STATUS tables ===");
  console.log(JSON.stringify(await q(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN
     ('Tenant','User','AcquisitionEntitlement','AcquisitionOrder','LeadResearch','OutreachOrder','OutreachEmail','FollowUp','LeadLifecycleEvent','AcquisitionProfile','Notification','AuditLog','GenerationBatch','VerificationToken') ORDER BY 1`
  )));
  console.log("=== PROD-DB-STATUS entitlement columns ===");
  console.log(JSON.stringify(await q(
    `SELECT column_name FROM information_schema.columns WHERE table_name='AcquisitionEntitlement' ORDER BY ordinal_position`
  )));
  console.log("=== PROD-DB-STATUS suspect columns ===");
  console.log(JSON.stringify(await q(
    `SELECT table_name, column_name FROM information_schema.columns WHERE
     (table_name='OutreachOrder' AND column_name IN ('sendClaimedAt','sendAttempts','replyStatus','deliveryStatus')) OR
     (table_name='LeadResearch') AND column_name IN ('business','email') OR
     (table_name='FollowUp' AND column_name='outreachOrderId') OR
     (table_name='AcquisitionOrder' AND column_name IN ('idempotencyKey','providerOrderId','paymentId'))`
  )));
  console.log("=== PROD-DB-STATUS policies ===");
  console.log(JSON.stringify(await q(
    `SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' ORDER BY 1,2`
  )));
  console.log("=== PROD-DB-STATUS force-vs-enabled ===");
  console.log(JSON.stringify(await q(
    `SELECT relname, relforcerowsecurity AS forced FROM pg_class WHERE relnamespace='public'::regnamespace AND relrowsecurity AND relkind='r' ORDER BY 1`
  )));
} catch (e) {
  console.log("PROBE_ERROR: " + String(e && e.message || e).slice(0, 1000));
} finally {
  await prisma.$disconnect();
  console.log("=== PROD-DB-STATUS done ===");
}
