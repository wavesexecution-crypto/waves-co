import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { FollowUpCreateSchema, FollowUpUpdateSchema } from "@/lib/acquisition";

export const dynamic = "force-dynamic";

/**
 * GET /api/acquisition/followups — own tenant's follow-ups (pending first).
 * POST /api/acquisition/followups — schedule one for an own order/lead.
 * PATCH /api/acquisition/followups — complete or cancel one ({ id, action }).
 * Follow-up state persists; completing/cancelling is explicit. Duplicate
 * scheduling for the same order+due-day returns the existing row.
 * Follow-ups never send automatically — completion only records that the
 * owner did the follow-up outside the system.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;

    await requireCommercialAccess(tenantId);

    const result = await withTenantContext(tenantId, async (tx: any) => {
      const followups = await tx.followUp.findMany({
        where: { tenantId },
        orderBy: [{ status: "asc" }, { dueAt: "asc" }],
        take: 100,
        select: {
          id: true, leadKey: true, business: true, dueAt: true, status: true,
          note: true, channel: true, campaignId: true, outreachEmailId: true,
          outreachOrderId: true, followUpNumber: true, completedAt: true, createdAt: true,
        },
      });
      const pending = await tx.followUp.count({ where: { tenantId, status: "pending" } });
      return { followups, pending };
    });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if ((e as any).status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED", detail: "Active trial or lease required." }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not load follow-ups." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    const userId = (session.user as any).id as string | undefined;

    const body = await req.json().catch(() => ({}));
    const parsed = FollowUpCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid follow-up", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 400 },
      );
    }
    const v = parsed.data;

    await requireCommercialAccess(tenantId);

    const result = await withTenantContext(tenantId, async (tx: any) => {
      let order: any = null;
      if (v.orderId) {
        order = await tx.outreachOrder.findFirst({ where: { id: v.orderId, tenantId } });
        if (!order) return { error: "Order not found", status: 404 };
      }
      const leadKey = v.leadKey ?? order?.leadKey ?? null;
      const business = v.business ?? order?.businessName ?? null;
      if (!business) return { error: "business is required", status: 400 };
      const dueAt = v.dueAt ? new Date(v.dueAt) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      if (Number.isNaN(dueAt.getTime())) return { error: "Invalid dueAt", status: 400 };

      const existing = order
        ? await tx.followUp.findFirst({
            where: {
              tenantId, outreachOrderId: order.id, status: "pending",
              dueAt: { gte: new Date(dueAt.getTime() - 12 * 60 * 60 * 1000), lte: new Date(dueAt.getTime() + 12 * 60 * 60 * 1000) },
            },
          })
        : null;
      if (existing) return { followup: existing, duplicate: true };

      const count = order
        ? await tx.followUp.count({ where: { tenantId, outreachOrderId: order.id } })
        : 0;
      const followup = await tx.followUp.create({
        data: {
          tenantId, leadKey, business, dueAt, status: "pending",
          note: v.note ?? null, channel: v.channel, outreachOrderId: order?.id ?? null,
          followUpNumber: count + 1,
        },
      });
      await tx.auditLog
        .create({ data: { tenantId, userId, action: "acquisition.followup.schedule", model: "FollowUp", recordId: followup.id, after: { orderId: order?.id ?? null } } })
        .catch(() => null);
      return { followup };
    });
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status ?? 400 });
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if ((e as any).status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED", detail: "Active trial or lease required." }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not schedule follow-up. Please retry." }, { status: 500 });
  }
}

/**
 * PATCH /api/acquisition/followups — explicitly complete or cancel one.
 * Body: { id, action: "complete" | "cancel" }. Tenant-scoped; terminal rows
 * are idempotent (returns reused:true). Completing only records that the
 * owner performed the follow-up — nothing is sent automatically.
 */
export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    const userId = (session.user as any).id as string | undefined;

    const body = await req.json().catch(() => ({}));
    const parsed = FollowUpUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid follow-up update", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 400 },
      );
    }

    await requireCommercialAccess(tenantId);

    const result = await withTenantContext(tenantId, async (tx: any) => {
      const row = await tx.followUp.findFirst({ where: { id: parsed.data.id, tenantId } });
      if (!row) return { error: "Follow-up not found", status: 404 };
      const to = parsed.data.action === "complete" ? "completed" : "cancelled";
      if (row.status === to) return { followup: row, reused: true };
      if (row.status === "completed" || row.status === "cancelled") {
        return { error: `Follow-up is already ${row.status}`, status: 409 };
      }
      const updated = await tx.followUp.update({
        where: { id: row.id },
        data: { status: to, completedAt: new Date() },
      });
      await tx.auditLog
        .create({ data: { tenantId, userId, action: "acquisition.followup.update", model: "FollowUp", recordId: row.id, after: { status: to } } })
        .catch(() => null);
      return { followup: updated };
    });
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status ?? 400 });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if ((e as any).status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED", detail: "Active trial or lease required." }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not update follow-up. Please retry." }, { status: 500 });
  }
}

