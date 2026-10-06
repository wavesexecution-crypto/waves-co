import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/acquisition/account — erase the tenant's Acquisition OS
 * workflow data (profile, imports, research, orders, emails, follow-ups,
 * lifecycle/activity events). Requires typed confirmation { confirm: "DELETE" }.
 *
 * Explicitly OUT of scope: Tenant/User rows, billing orders, entitlements,
 * audit logs. Identity and money trails are never deleted here.
 */
export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    const userId = (session.user as any).id as string | undefined;

    const body = await req.json().catch(() => ({}));
    if (body.confirm !== "DELETE") {
      return NextResponse.json({ error: 'Confirmation required: send { "confirm": "DELETE" }.' }, { status: 400 });
    }

    const deleted = await withTenantContext(tenantId, async (tx: any) => {
      const counts: Record<string, number> = {};
      // Children first (FK-safe even without DB cascades).
      counts.followUps = (await tx.followUp.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }))).count ?? 0;
      counts.lifecycleEvents = (await tx.leadLifecycleEvent.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }))).count ?? 0;
      counts.outreachEmails = (await tx.outreachEmail.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }))).count ?? 0;
      counts.orders = (await tx.outreachOrder.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }))).count ?? 0;
      counts.research = (await tx.leadResearch.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }))).count ?? 0;
      counts.campaigns = (await tx.campaign.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }))).count ?? 0;
      counts.activityEvents = (await tx.activityEvent.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }))).count ?? 0;
      counts.dataImports = (await tx.acquisitionDataImport.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }))).count ?? 0;
      counts.profiles = (await tx.acquisitionProfile.deleteMany({ where: { tenantId } }).catch(() => ({ count: 0 }))).count ?? 0;
      await tx.auditLog
        .create({ data: { tenantId, userId, action: "acquisition.account.erase", model: "Tenant", recordId: tenantId, after: counts } })
        .catch(() => null);
      return counts;
    });
    return NextResponse.json({ deleted });
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "internal", detail: "Could not erase workflow data. Please retry." }, { status: 500 });
  }
}
