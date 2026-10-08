import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { clientIpFromHeaders, consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { createAiJob } from "@/lib/ai-jobs";

export const dynamic = "force-dynamic";

const DirectionSchema = z.object({
  kind: z.enum(["answer", "qualify", "inform", "book", "custom"]),
  customText: z.string().trim().min(3).max(2000).nullish(),
});

/**
 * POST /api/acquisition/reply-reports/[id]/direction — GIVE WAVES A DIRECTION.
 * Persists the instruction and queues a REPLY_DIRECTION job that drafts a
 * response for human review. The draft is NEVER auto-sent: sending happens
 * only through the normal approved-send path.
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

    const body = await req.json().catch(() => ({}));
    const parsed = DirectionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid direction" }, { status: 400 });
    if (parsed.data.kind === "custom" && !parsed.data.customText) {
      return NextResponse.json({ error: "customText is required for custom direction" }, { status: 400 });
    }

    await requireCommercialAccess(tenantId);
    const { id } = await params;

    const result = await withTenantContext(tenantId, async (tx: any) => {
      const report = await tx.replyReport.findFirst({ where: { id, tenantId }, include: { directions: { orderBy: { createdAt: "desc" }, take: 1 } } });
      if (!report) return { error: "Reply report not found", status: 404 };
      const direction = await tx.replyDirection.create({
        data: {
          tenantId, replyReportId: report.id, kind: parsed.data.kind,
          customText: parsed.data.customText ?? null, status: "pending",
        },
      });
      await tx.auditLog.create({
        data: { tenantId, userId, action: "acquisition.reply.direction", model: "ReplyDirection", recordId: direction.id, after: { kind: parsed.data.kind } },
      }).catch(() => null);
      return { report, direction };
    });
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status ?? 400 });

    const created: any = await createAiJob({
      tenantId, cycleId: (result as any).report.cycleId, operation: "REPLY_DIRECTION",
      inputRef: {
        directionId: (result as any).direction.id, reportId: (result as any).report.id,
        kind: parsed.data.kind, customText: parsed.data.customText ?? null,
        report: {
          replyStatus: (result as any).report.replyStatus, intent: (result as any).report.intent,
          summary: (result as any).report.summary, objections: (result as any).report.objections,
          askingFor: (result as any).report.askingFor,
        },
      },
      idempotencyParts: ["reply-direction", (result as any).direction.id],
    });
    return NextResponse.json({ ...(result as any), draftJob: created.job }, { status: 201 });
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not save direction." }, { status: 500 });
  }
}
