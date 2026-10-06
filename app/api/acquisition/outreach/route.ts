import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * GET /api/acquisition/outreach — own tenant's outreach orders grouped for
 * review: ready (READY_FOR_APPROVAL/PENDING), approved pipeline, sent,
 * failed. Draft copy shown is the stored copy — generated at import from
 * stored research, never fabricated at read time.
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;

    await requireCommercialAccess(tenantId);

    const url = new URL(req.url);
    const group = (url.searchParams.get("group") ?? "all").toLowerCase();
    const groups: Record<string, string[]> = {
      ready: ["READY_FOR_APPROVAL", "PENDING"],
      approved: ["APPROVED"],
      sent: ["SENT", "DELIVERED"],
      failed: ["FAILED"],
    };
    if (group !== "all" && !groups[group]) {
      return NextResponse.json({ error: "Invalid group. Use ready|approved|sent|failed|all." }, { status: 400 });
    }

    const result = await withTenantContext(tenantId, async (tx: any) => {
      const where: any = { tenantId };
      if (group !== "all") where.status = { in: groups[group] };
      const orders = await tx.outreachOrder.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: {
          id: true, leadKey: true, businessName: true, contactName: true,
          contactRole: true, email: true, subject: true, body: true,
          status: true, sendId: true, deliveryStatus: true, sendError: true,
          decidedAt: true, sentAt: true, createdAt: true, updatedAt: true,
        },
      });
      const counts: Record<string, number> = {};
      for (const [k, v] of Object.entries(groups)) {
        counts[k] = await tx.outreachOrder.count({ where: { tenantId, status: { in: v } } });
      }
      return { orders, counts };
    });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if ((e as any).status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED", detail: "Active trial or lease required." }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not load outreach." }, { status: 500 });
  }
}
