import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { validateOrderTransition } from "@/lib/acquisition";

export const dynamic = "force-dynamic";

/**
 * POST /api/acquisition/outreach/send — send one APPROVED order.
 * Body: { orderId }.
 *
 * Gating: only APPROVED orders send (owner approval required by design).
 * Idempotent: an order with sendId returns the current order with
 * reused:true — retries never duplicate sends. Failure is recorded on the
 * order (FAILED + sendError), never reported as sent. A send is only
 * recorded SENT when the email provider confirms acceptance.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    const userId = (session.user as any).id as string | undefined;

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 });

    await requireCommercialAccess(tenantId);

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.SMTP_FROM ?? "WavesCo <noreply@wavesco.in>";

    const result = await withTenantContext(tenantId, async (tx: any) => {
      const order = await tx.outreachOrder.findFirst({ where: { id: orderId, tenantId } });
      if (!order) return { error: "Order not found", status: 404 };
      if (order.sendId && order.status !== "APPROVED") {
        return { order, reused: true };
      }
      const blocked = validateOrderTransition(order.status, "SENT");
      if (blocked) return { error: blocked, status: 409 };

      if (!apiKey) {
        const failed = await tx.outreachOrder.update({
          where: { id: order.id },
          data: { status: "FAILED", sendError: "Email provider not configured. Contact support." },
        });
        await tx.leadLifecycleEvent.create({
          data: { tenantId, leadKey: order.leadKey, stage: "send", status: "FAILED", reason: "provider_not_configured", orderId: order.id },
        });
        return { order: failed };
      }

      const sendId = `send_${randomUUID().replace(/-/g, "")}`;
      try {
        // @ts-ignore — resend is optional, dynamically imported
        const { Resend } = await import("resend" as any);
        const resend = new Resend(apiKey);
        const { error } = await resend.emails.send({
          from, to: [order.email], subject: order.subject, text: order.body,
        });
        if (error) throw new Error(error.message ?? "Email provider rejected the send");
        const now = new Date();
        const sent = await tx.outreachOrder.update({
          where: { id: order.id },
          data: { status: "SENT", sendId, sentAt: now, sendError: null, deliveryStatus: "SENT" },
        });
        await tx.leadLifecycleEvent.create({
          data: { tenantId, leadKey: order.leadKey, stage: "send", status: "SENT", orderId: order.id },
        });
        await tx.auditLog
          .create({ data: { tenantId, userId, action: "acquisition.outreach.send", model: "OutreachOrder", recordId: order.id, after: { sendId } } })
          .catch(() => null);
        return { order: sent };
      } catch (sendErr: any) {
        const failed = await tx.outreachOrder.update({
          where: { id: order.id },
          data: { status: "FAILED", sendError: String(sendErr?.message ?? "Send failed").slice(0, 500) },
        });
        await tx.leadLifecycleEvent.create({
          data: { tenantId, leadKey: order.leadKey, stage: "send", status: "FAILED", reason: "provider_error", orderId: order.id },
        });
        return { order: failed };
      }
    });
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status ?? 400 });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if ((e as any).status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED", detail: "Active trial or lease required." }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not send. Please retry." }, { status: 500 });
  }
}
