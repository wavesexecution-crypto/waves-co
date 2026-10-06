import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * GET /api/acquisition/replies — own tenant's outreach emails that carry a
 * reply signal (replyStatus set), newest first. No inbound provider is
 * wired yet, so this honestly returns whatever is stored (empty until
 * replies are recorded) — it never fabricates replies.
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;

    await requireCommercialAccess(tenantId);

    const url = new URL(req.url);
    const category = (url.searchParams.get("category") ?? "all").toLowerCase();
    if (category !== "all" && !["interested", "not-interested", "follow-up", "other"].includes(category)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }

    const result = await withTenantContext(tenantId, async (tx: any) => {
      const where: any = { tenantId, replyStatus: { not: null } };
      const replies = await tx.outreachEmail.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: {
          id: true, leadKey: true, business: true, email: true, subject: true,
          body: true, status: true, replyStatus: true, sentAt: true,
          createdAt: true, updatedAt: true,
        },
      });
      const filtered = category === "all" ? replies : replies.filter((r: any) => (r.replyStatus ?? "").toLowerCase().replace(/_/g, "-") === category);
      return { replies: filtered, total: replies.length, inboundConfigured: false };
    });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if ((e as any).status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED", detail: "Active trial or lease required." }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not load replies." }, { status: 500 });
  }
}
