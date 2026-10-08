import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenantContext } from "@/lib/context";
import { verifyN8nSignature } from "@/lib/n8n";

export const dynamic = "force-dynamic";

const N8nInboundSchema = z.object({
  tenantId: z.string().min(1).max(200),
  cycleId: z.string().min(1).max(100).nullish(),
  jobId: z.string().min(1).max(100).nullish(),
  eventId: z.string().min(1).max(200),
  event: z.string().min(1).max(120),
  status: z.enum(["completed", "failed"]).nullish(),
  result: z.unknown().nullish(),
  error: z.string().max(2000).nullish(),
});

/**
 * POST /api/n8n/webhook — authenticated automation callbacks.
 *
 * - HMAC-SHA256 over the RAW body with N8N_WEBHOOK_SECRET (timing-safe).
 *   Missing/bad signature -> 401, nothing applied, nothing logged beyond
 *   a counter-safe message.
 * - Exactly-once by eventId (N8nEvent unique log): replays return the stored
 *   outcome as `duplicate` without re-applying transitions.
 * - Transitions only touch jobs owned by the event's tenant; unknown jobs
 *   are recorded (observable) but change nothing.
 * - No session required (machine caller), but tenant scope is enforced from
 *   the signed payload + job ownership check.
 */
export async function POST(req: Request) {
  const raw = await req.text().catch(() => "");
  const signature = req.headers.get("x-waves-signature");
  if (!verifyN8nSignature(raw, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const parsed = N8nInboundSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  const ev = parsed.data;

  try {
    const outcome = await withTenantContext(ev.tenantId, async (tx: any) => {
      try {
        await tx.n8nEvent.create({
          data: { tenantId: ev.tenantId, eventId: ev.eventId, jobId: ev.jobId ?? null, event: ev.event, outcome: "applied" },
        });
      } catch (e: any) {
        if (e?.code === "P2002") {
          const prev = await tx.n8nEvent.findUnique({ where: { eventId: ev.eventId } });
          if (!prev || prev.tenantId !== ev.tenantId) {
            return { outcome: "rejected" as const };
          }
          return { outcome: "duplicate" as const, previous: prev.outcome };
        }
        throw e;
      }
      if (ev.jobId) {
        const job = await tx.n8nJob.findFirst({ where: { id: ev.jobId, tenantId: ev.tenantId } });
        if (job && job.status !== "COMPLETED") {
          if (ev.status === "completed") {
            await tx.n8nJob.updateMany({
              where: { id: job.id, status: { not: "COMPLETED" } },
              data: { status: "COMPLETED", result: ev.result ?? null, lastError: null, nextRetryAt: null },
            });
          } else if (ev.status === "failed") {
            await tx.n8nJob.updateMany({
              where: { id: job.id, status: { not: "COMPLETED" } },
              data: { status: "RETRY_PENDING", lastError: String(ev.error ?? "n8n reported failure").slice(0, 1000), nextRetryAt: new Date(Date.now() + 5 * 60 * 1000) },
            });
          }
        }
      }
      return { outcome: "applied" as const };
    });
    if ((outcome as any).outcome === "rejected") return NextResponse.json({ error: "event_tenant_mismatch" }, { status: 403 });
    return NextResponse.json({ ok: true, ...(outcome as object) });
  } catch (e: any) {
    console.error("[n8n/webhook] failed", { code: (e as any)?.code ?? "unknown" });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
