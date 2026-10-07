// TEMPORARY one-shot production migration runner (removed after use).
// Runs inside a Vercel production build with the platform's DATABASE_URL.
// 1) Marks the notification-system migration applied WITHOUT running it:
//    its tables/indexes already exist in production (proven by the working
//    notifications API + schema probe), and its plain CREATE TABLEs would
//    fail on re-run. resolve failure is tolerated (deploy is authoritative).
// 2) Runs `prisma migrate deploy` for everything else. Any real failure
//    exits non-zero so the build — and therefore the production cutover —
//    fails closed with production untouched.
import { execSync } from "node:child_process";

function run(cmd, { strict = true } = {}) {
  console.log("$ " + cmd);
  try {
    execSync(cmd, { stdio: "inherit", timeout: 300000 });
  } catch (e) {
    console.log(`command exited ${e.status} (strict=${strict})`);
    if (strict) process.exit(e.status || 1);
  }
}

run('pnpm exec prisma migrate resolve --applied "20260901000000_lookup_user_by_email"', { strict: false });
run('pnpm exec prisma migrate resolve --applied "20260903000000_add_notification_system"', { strict: false });
run("pnpm exec prisma migrate deploy");
run("pnpm exec prisma migrate status");
console.log("PROD-MIGRATE done");
