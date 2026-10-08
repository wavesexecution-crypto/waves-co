import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { clientIpFromHeaders, consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/acquisition/templates/[id]/approve — approve one version for its
 * cycle. Exactly one approved version per cycle: approval is a conditional
 * transition (draft -> approved) and the previously approved version, if any,
 * returns to draft so history keeps every version but only one is live.
 * Closed cycles refuse approval (history immutable).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    const userId = (session.user as any).id as string | undefined;

    const limit = consumeRateLimit(`${tenantId}:${clientIpFromHeaders(req.headers)}`, "cycle");
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(limit) });
    }

    await requireCommercialAccess(tenantId);
    const { id } = await params;

    const result = await withTenantContext(tenantId, async (tx: any) => {
      const template = await tx.messageTemplate.findFirst({ where: { id, tenantId } });
      if (!template) return { error: "Template not found", status: 404 };
      const cycle = await tx.acquisitionCycle.findFirst({ where: { id: template.cycleId, tenantId } });
      if (!cycle || cycle.status === "CLOSED") return { error: "Cycle is closed — history cannot change", status: 409 };
      if (template.status === "approved") return { template, reused: true };
      await tx.messageTemplate.updateMany({
        where: { tenantId, cycleId: template.cycleId, status: "approved" },
        data: { status: "draft" },
      });
      const approved = await tx.messageTemplate.updateMany({
        where: { id: template.id, status: "draft" },
        data: { status: "approved", approvedAt: new Date(), approvedBy: userId ?? null },
      });
      if (approved.count !== 1) return { error: "Template changed concurrently — reload and retry.", status: 409 };
      await tx.auditLog.create({
        data: { tenantId, userId, action: "acquisition.template.approve", model: "MessageTemplate", recordId: template.id, after: { version: template.version } },
      }).catch(() => null);
      return { template: { ...template, status: "approved" } };
    });
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status ?? 400 });
    return NextResponse.json(result);
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not approve template." }, { status: 500 });
  }
}
