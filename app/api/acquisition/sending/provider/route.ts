import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { clientIpFromHeaders, consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { connectCustomProvider, disconnectCustomProvider } from "@/lib/email-provider";

export const dynamic = "force-dynamic";

const ConnectSchema = z.object({
  action: z.literal("connect"),
  apiKey: z.string().min(10).max(500),
  label: z.string().trim().max(80).nullish(),
});
const SelectSchema = z.object({
  action: z.literal("select"),
  provider: z.enum(["waves", "custom"]),
});
const DisconnectSchema = z.object({ action: z.literal("disconnect") });
const ProviderPostSchema = z.union([ConnectSchema, SelectSchema, DisconnectSchema]);

/**
 * GET — honest sending state: which provider path is selected, whether a
 * custom key is connected (label + last4 only, never the key), and whether
 * each path can actually send right now.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    await requireCommercialAccess(tenantId);
    const result = await withTenantContext(tenantId, async (tx: any) => {
      const cred = await tx.emailCredential.findUnique({ where: { tenantId } });
      const integration = await tx.integrationStatus.findUnique({
        where: { tenantId_key: { tenantId, key: "email-provider" } },
      }).catch(() => null);
      const wavesReady = !!process.env.RESEND_API_KEY;
      return {
        selected: integration?.detail?.startsWith("custom") ? "custom" : "waves",
        waves: {
          available: wavesReady,
          note: wavesReady
            ? "WAVES sends via its provider under platform limits. Replies land in your own inbox."
            : "WAVES sending is not configured right now.",
        },
        custom: cred
          ? { connected: true, label: cred.label, keyLast4: cred.keyLast4, verifiedAt: cred.verifiedAt }
          : { connected: false },
      };
    });
    return NextResponse.json(result);
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not load sending state." }, { status: 500 });
  }
}

/**
 * POST — connect (live-validates the key, encrypts, stores), select
 * (waves|custom for subsequent sends), or disconnect (deletes the row).
 */
export async function POST(req: Request) {
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
    const parsed = ProviderPostSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid provider request" }, { status: 400 });

    await requireCommercialAccess(tenantId);

    const result = await withTenantContext(tenantId, async (tx: any) => {
      if (parsed.data.action === "connect") {
        const r = await connectCustomProvider(tx, tenantId, parsed.data.apiKey, parsed.data.label ?? undefined);
        if (!r.ok) return { error: r.error, status: 400 };
        await tx.auditLog.create({
          data: { tenantId, userId, action: "acquisition.sending.connect", model: "EmailCredential", recordId: tenantId, after: { keyLast4: r.keyLast4 } },
        }).catch(() => null);
        return { connected: true, keyLast4: r.keyLast4 };
      }
      if (parsed.data.action === "disconnect") {
        await disconnectCustomProvider(tx, tenantId);
        await tx.auditLog.create({
          data: { tenantId, userId, action: "acquisition.sending.disconnect", model: "EmailCredential", recordId: tenantId },
        }).catch(() => null);
        return { connected: false };
      }
      if (parsed.data.provider === "custom") {
        const cred = await tx.emailCredential.findUnique({ where: { tenantId } });
        if (!cred?.verifiedAt) return { error: "No verified custom key — connect one first.", status: 409 };
      }
      await tx.integrationStatus.upsert({
        where: { tenantId_key: { tenantId, key: "email-provider" } },
        create: { tenantId, key: "email-provider", state: "selected", detail: parsed.data.provider },
        update: { state: "selected", detail: parsed.data.provider },
      });
      return { selected: parsed.data.provider };
    });
    if ((result as any).error) return NextResponse.json({ error: (result as any).error }, { status: (result as any).status ?? 400 });
    return NextResponse.json(result);
  } catch (e: any) {
    if ((e as any)?.status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED" }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not update sending provider." }, { status: 500 });
  }
}
