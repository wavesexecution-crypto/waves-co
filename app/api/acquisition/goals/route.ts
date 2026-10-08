import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * GET /api/acquisition/goals — tenant's goals newest-first for the
 * "use previous goal" picker. Cloning (not mutating) happens at
 * POST /api/acquisition/cycles.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    await requireCommercialAccess(tenantId);
    const result = await withTenantContext(tenantId, async (tx: any) => {
      const goals = await tx.cycleGoal.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { cycle: { select: { id: true, cycleNumber: true, status: true } } },
      });
      return { goals };
    });
    return NextResponse.json(result);
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not list goals." }, { status: 500 });
  }
}
