import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { clientIpFromHeaders, consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { claimOrder, executeOrderSend } from "@/lib/outreach-send";
import { onNotificationEvent } from "@/lib/notifications";
import { emitN8nEvent, n8nHealth } from "@/lib/n8n";

export const dynamic = "force-dynamic";

const DrainSchema = z.object({
  cycleId: z.string().min(1).max(100).nullish(),
  limit: z.number().int().min(1).max(25).nullish(),
  tenantId: z.string().min(1).max(200).nullish(),
});

/**
 * POST /api/acquisition/outreach/drain — process the send queue.
 *
 * Picks APPROVED, unsent orders (optionally cycle-scoped) and executes each
 * through the same atomic-claim pipeline as single sends, bounded per call.
 * Auth: owner session (tenant from session), OR service callers presenting
 * the shared automation secret in X-Waves-Service with an explicit tenantId
 * (the contract a future n8n schedule workflow uses — no session needed).
 * Emits one n8n summary event only when n8n is actually configured.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = DrainSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid drain request" }, { status: 400 });

    let tenantId: string | undefined;
    let userId: string | undefined;
    const session = await auth();
    if (session?.user?.tenantId) {
      tenantId = session.user.tenantId as string;
      userId = (session.user as any).id as string | undefined;
    } else {
      const svc = req.headers.get("x-waves-service");
      const secret = process.env.N8N_WEBHOOK_SECRET;
      if (!secret || !svc || svc !== secret || !parsed.data.tenantId) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      tenantId = parsed.data.tenantId;
    }

    const limit = consumeRateLimit(`${tenantId}:${clientIpFromHeaders(req.headers)}`, "outreach");
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(limit) });
    }

    await requireCommercialAccess(tenantId);
    const take = Math.min(25, Math.max(1, parsed.data.limit ?? 10));

    const due = await withTenantContext(tenantId, async (tx: any) => {
      const where: any = { tenantId, status: "APPROVED", sendId: null };
      if (parsed.data.cycleId) {
        const cycle = await tx.acquisitionCycle.findFirst({ where: { id: parsed.data.cycleId, tenantId } });
        if (!cycle) return { error: "Cycle not found", status: 404 };
        where.cycleId = cycle.id;
      }
      return tx.outreachOrder.findMany({ where, orderBy: { createdAt: "asc" }, take, select: { id: true } });
    });
    if ((due as any)?.error) return NextResponse.json({ error: (due as any).error }, { status: (due as any).status ?? 400 });

    const results: Array<{ orderId: string; outcome: string }> = [];
    for (const row of due as Array<{ id: string }>) {
      try {
        const claim = await claimOrder(tenantId, row.id);
        if (claim.kind !== "claimed") {
          results.push({ orderId: row.id, outcome: claim.kind });
          continue;
        }
        const { sent } = await executeOrderSend({
          tenantId, userId, claim,
          notify: (event, opts) => onNotificationEvent(tenantId!, event, opts),
        });
        results.push({ orderId: row.id, outcome: sent ? "sent" : "failed" });
      } catch (e: any) {
        results.push({ orderId: row.id, outcome: `error: ${String(e?.message ?? e).slice(0, 120)}` });
      }
    }
    const summary = {
      attempted: results.length,
      sent: results.filter((r) => r.outcome === "sent").length,
      failed: results.filter((r) => r.outcome === "failed" || r.outcome.startsWith("error")).length,
      skipped: results.filter((r) => r.outcome === "reused" || r.outcome === "unauthorized" || r.outcome === "invalid").length,
    };
    if (n8nHealth().configured) {
      try {
        await emitN8nEvent({
          tenantId, cycleId: parsed.data.cycleId ?? null, event: "send.queue.drained",
          payload: { ...summary, results: results.slice(0, 25) },
          idempotencyParts: ["drain", tenantId, parsed.data.cycleId ?? "all", String(Date.now())],
        });
      } catch { /* observability only */ }
    }
    return NextResponse.json({ ...summary, results });
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not drain queue." }, { status: 500 });
  }
}
