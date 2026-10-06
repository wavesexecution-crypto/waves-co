import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { ProfileSubmitSchema } from "@/lib/acquisition";

export const dynamic = "force-dynamic";

/**
 * GET /api/acquisition/profile — own tenant's business context (or null).
 * PUT /api/acquisition/profile — validate + upsert own business context.
 *
 * Tenant is derived from the session. Refresh-safe: GET returns whatever
 * was persisted, so a reload never loses submitted state. Duplicate
 * submission is safe: one row per tenant (upsert on tenantId unique).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    const profile = await withTenantContext(tenantId, async (tx: any) =>
      tx.acquisitionProfile.findUnique({ where: { tenantId } }),
    );
    return NextResponse.json({ profile });
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "internal", detail: "Could not load business context." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    const userId = (session.user as any).id as string | undefined;

    const body = await req.json().catch(() => ({}));
    const parsed = ProfileSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid business context", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 400 },
      );
    }
    const v = parsed.data;

    const profile = await withTenantContext(tenantId, async (tx: any) => {
      const now = new Date();
      const existing = await tx.acquisitionProfile.findUnique({ where: { tenantId } });
      const data = {
        companyName: v.companyName,
        website: v.website,
        industry: v.industry,
        businessModel: v.businessModel ?? null,
        targetQuantity: v.targetQuantity ?? null,
        targetTimeframe: v.targetTimeframe ?? null,
        whatWeSell: v.offer?.whatWeSell ?? null,
        icp: v.icp,
        offer: v.offer ?? null,
        version: (existing?.version ?? 0) + 1,
        status: "ACTIVE",
        activatedAt: existing?.activatedAt ?? now,
        updatedAt: now,
      };
      const saved = existing
        ? await tx.acquisitionProfile.update({ where: { tenantId }, data })
        : await tx.acquisitionProfile.create({ data: { tenantId, ...data } });
      await tx.auditLog
        .create({ data: { tenantId, userId, action: "acquisition.profile.upsert", model: "AcquisitionProfile", recordId: saved.id, after: { version: saved.version } } })
        .catch(() => null);
      return saved;
    });
    return NextResponse.json({ profile });
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "internal", detail: "Could not save business context. Please retry." }, { status: 500 });
  }
}
