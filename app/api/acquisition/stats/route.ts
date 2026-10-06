import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { buildStats } from "@/lib/acquisition";

export const dynamic = "force-dynamic";

/**
 * GET /api/acquisition/stats — truthful counts from stored rows for the
 * authenticated tenant. No hardcoded metrics: every number is a live
 * COUNT over tenant-scoped tables. Visible to any signed-in tenant member
 * (zeros are honest for new workspaces).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;

    const stats = await withTenantContext(tenantId, async (tx: any) => {
      const [ready, approved, rejected, sent, failed, replies, interested, followUpsPending] = await Promise.all([
        tx.outreachOrder.count({ where: { tenantId, status: { in: ["READY_FOR_APPROVAL", "PENDING"] } } }),
        tx.outreachOrder.count({ where: { tenantId, status: "APPROVED" } }),
        tx.outreachOrder.count({ where: { tenantId, status: { in: ["REJECTED", "CANCELLED"] } } }),
        tx.outreachOrder.count({ where: { tenantId, status: { in: ["SENT", "DELIVERED"] } } }),
        tx.outreachOrder.count({ where: { tenantId, status: "FAILED" } }),
        tx.outreachEmail.count({ where: { tenantId, replyStatus: { not: null } } }),
        tx.outreachEmail.count({ where: { tenantId, replyStatus: "INTERESTED" } }),
        tx.followUp.count({ where: { tenantId, status: "pending" } }),
      ]);
      return buildStats({ ready, approved, rejected, sent, failed, replies, interested, followUpsPending });
    });
    return NextResponse.json({ stats });
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "internal", detail: "Could not load stats." }, { status: 500 });
  }
}
