import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    const userId = (session.user as any).id as string | undefined;
    const result = await withTenantContext(tenantId, async (tx: any) => {
      const existing = await tx.acquisitionEntitlement.findUnique({ where: { tenantId } });
      if (existing) {
        if (existing.status === "TRIAL" || existing.status === "ACTIVE") {
          return { error: "Trial already active or already used", status: 409 };
        }
        if (existing.trialStartedAt) {
          return { error: "Trial already used", status: 409 };
        }
      }
      const now = new Date();
      const expires = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      const ent = await tx.acquisitionEntitlement.upsert({
        where: { tenantId },
        create: {
          tenantId,
          product: "acquisition_os",
          status: "TRIAL",
          leaseType: "TRIAL_2D",
          trialStartedAt: now,
          trialExpiresAt: expires,
          pricePaise: 0,
          currency: "INR",
        },
        update: {
          status: "TRIAL",
          leaseType: "TRIAL_2D",
          trialStartedAt: now,
          trialExpiresAt: expires,
        },
      });
      await tx.auditLog.create({ data: { tenantId, userId, action: "billing.trial.start", model: "AcquisitionEntitlement", recordId: ent.id, after: ent } });
      return { entitlement: ent };
    });
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "internal", detail: e.message }, { status: 500 });
  }
}
