import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { LeadDecisionSchema, validateOrderTransition } from "@/lib/acquisition";
import { clientIpFromHeaders, consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/acquisition/leads/decision — approve or reject a review order.
 * Body: { orderId, decision: APPROVED | REJECTED }.
 *
 * Ownership is enforced by scoping the lookup to (tenantId, id).
 * Idempotent: deciding an already-decided order returns the current order
 * with reused:true instead of duplicating lifecycle events. Terminal orders
 * cannot transition.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    const userId = (session.user as any).id as string | undefined;

    const body = await req.json().catch(() => ({}));
    const parsed = LeadDecisionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid decision", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 400 },
      );
    }

    // Decision flips are cheap but state-changing — shape automated abuse.
    const decisionLimit = consumeRateLimit(`${tenantId}:${clientIpFromHeaders(req.headers)}`, "outreach");
    if (!decisionLimit.allowed) {
      return NextResponse.json(
        { error: "rate_limited", detail: "Too many decision requests. Please wait and retry." },
        { status: 429, headers: rateLimitHeaders(decisionLimit) },
      );
    }

    await requireCommercialAccess(tenantId);

    const result = await withTenantContext(tenantId, async (tx: any) => {
      const order = await tx.outreachOrder.findFirst({
        where: { id: parsed.data.orderId, tenantId },
      });
      if (!order) return { error: "Lead not found", status: 404 };

      const to = parsed.data.decision;
      if (order.status === to) {
        return { order, reused: true };
      }
      const blocked = validateOrderTransition(order.status, to);
      if (blocked) return { error: blocked, status: 409 };

      const now = new Date();
      const updated = await tx.outreachOrder.update({
        where: { id: order.id },
        data: { status: to, decidedAt: now, approvalId: userId ?? order.approvalId ?? null },
      });
      await tx.leadLifecycleEvent.create({
        data: { tenantId, leadKey: order.leadKey, stage: "decision", status: to, reason: `decided_by_owner`, orderId: order.id, approvalId: userId ?? null },
      });
      await tx.auditLog
        .create({ data: { tenantId, userId, action: "acquisition.lead.decision", model: "OutreachOrder", recordId: order.id, after: { status: to } } })
        .catch(() => null);
      return { order: updated };
    });
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status ?? 400 });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if ((e as any).status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED", detail: "Active trial or lease required." }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not record decision. Please retry." }, { status: 500 });
  }
}
