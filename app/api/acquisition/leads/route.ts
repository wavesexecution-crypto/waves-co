import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import { LeadImportSchema, draftOutreachForLead, leadKeyForImport } from "@/lib/acquisition";
import { onNotificationEvent } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const PAGE_SIZE_MAX = 50;

/**
 * GET /api/acquisition/leads — own tenant's researched leads.
 * Query: status=ready|approved|rejected|all (default all), q (search
 * business/contact/email), page (1-based), pageSize (≤50).
 * All filters apply inside the tenant scope — pagination can never cross
 * tenant boundaries.
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;

    // Entitlement gate runs OUTSIDE the tenant transaction: getEntitlement
    // opens its own transaction and Prisma transactions cannot nest.
    await requireCommercialAccess(tenantId);

    const url = new URL(req.url);
    const status = (url.searchParams.get("status") ?? "all").toLowerCase();
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20));

    // Review-queue mapping over stored order statuses (no new columns):
    // ready → READY_FOR_APPROVAL, approved → APPROVED (+SENT pipeline),
    // rejected → REJECTED.
    const statusMap: Record<string, string[]> = {
      ready: ["READY_FOR_APPROVAL", "PENDING"],
      approved: ["APPROVED", "SENT", "DELIVERED"],
      rejected: ["REJECTED", "CANCELLED", "FAILED"],
    };
    const statuses = status === "all" ? null : statusMap[status] ?? null;
    if (status !== "all" && !statuses) {
      return NextResponse.json({ error: "Invalid status. Use ready|approved|rejected|all." }, { status: 400 });
    }

    const result = await withTenantContext(tenantId, async (tx: any) => {
      const where: any = { tenantId };
      if (statuses) where.status = { in: statuses };
      if (q) {
        where.OR = [
          { businessName: { contains: q, mode: "insensitive" } },
          { contactName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ];
      }
      const [total, orders] = await Promise.all([
        tx.outreachOrder.count({ where }),
        tx.outreachOrder.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true, leadKey: true, version: true, businessName: true,
            contactName: true, contactRole: true, email: true, subject: true,
            body: true, opportunity: true, status: true, decidedAt: true,
            sentAt: true, sendError: true, createdAt: true, updatedAt: true,
          },
        }),
      ]);
      const counts: Record<string, number> = {};
      for (const [k, v] of Object.entries({ ready: statusMap.ready, approved: statusMap.approved, rejected: statusMap.rejected })) {
        counts[k] = await tx.outreachOrder.count({ where: { tenantId, status: { in: v } } });
      }
      return { leads: orders, total, page, pageSize, counts };
    });
    return NextResponse.json(result);
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const code = (e as any).status === 402 ? 402 : 500;
    return NextResponse.json({ error: code === 402 ? "ENTITLEMENT_REQUIRED" : "internal", detail: code === 402 ? "Active trial or lease required." : "Could not load leads." }, { status: code });
  }
}

/**
 * POST /api/acquisition/leads — import one prospect into the review queue.
 * Requires an active trial or paid lease. Creates/refreshes the LeadResearch
 * row (upsert on tenant+leadKey — re-import never duplicates) and ensures a
 * version-1 READY_FOR_APPROVAL OutreachOrder with stored draft copy.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    const userId = (session.user as any).id as string | undefined;

    const body = await req.json().catch(() => ({}));
    const parsed = LeadImportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid prospect", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
        { status: 400 },
      );
    }
    const v = parsed.data;

    // Gate outside the transaction (see GET above for why).
    await requireCommercialAccess(tenantId);

    const result = await withTenantContext(tenantId, async (tx: any) => {
      const profile = await tx.acquisitionProfile.findUnique({ where: { tenantId } });
      const companyName = profile?.companyName ?? "your company";
      const leadKey = leadKeyForImport(v.business, v.email);
      const now = new Date();

      const research = await tx.leadResearch.upsert({
        where: { tenantId_leadKey: { tenantId, leadKey } },
        create: {
          tenantId, leadKey, business: v.business, contactName: v.contactName ?? null,
          contactRole: v.contactRole ?? null, email: v.email.trim().toLowerCase(),
          website: v.website ?? null, city: v.city ?? null, area: v.area ?? null,
          category: v.category ?? null, opportunity: v.opportunity ?? null,
          notes: v.notes ?? null, researchedAt: now,
        },
        update: {
          business: v.business, contactName: v.contactName ?? null, contactRole: v.contactRole ?? null,
          email: v.email.trim().toLowerCase(), website: v.website ?? null, city: v.city ?? null,
          area: v.area ?? null, category: v.category ?? null, opportunity: v.opportunity ?? null,
          notes: v.notes ?? null, checkedAt: now,
        },
      });

      const draft = draftOutreachForLead({ businessName: v.business, contactName: v.contactName, opportunity: v.opportunity, companyName });
      const existingOrder = await tx.outreachOrder.findUnique({
        where: { tenantId_leadKey_version: { tenantId, leadKey, version: 1 } },
      });
      let order;
      if (!existingOrder) {
        order = await tx.outreachOrder.create({
          data: {
            tenantId, version: 1, leadKey, businessName: v.business,
            contactName: v.contactName ?? null, contactRole: v.contactRole ?? null,
            email: v.email.trim().toLowerCase(), emailStatus: "IMPORTED",
            researchSnapshot: { leadKey, business: v.business } as any,
            opportunity: v.opportunity ?? null, subject: draft.subject, body: draft.body,
            followupPlan: {} as any, status: "READY_FOR_APPROVAL", submittedAt: now,
          },
        });
        await tx.leadLifecycleEvent.create({
          data: { tenantId, leadKey, stage: "import", status: "READY_FOR_APPROVAL", orderId: order.id },
        });
      } else {
        order = existingOrder;
      }

      await tx.auditLog
        .create({ data: { tenantId, userId, action: "acquisition.lead.import", model: "OutreachOrder", recordId: order.id, after: { leadKey } } })
        .catch(() => null);
      return { research, order, duplicate: !!existingOrder };
    });
    // Real event: new draft outreach is waiting for review.
    // Fired after the transaction commits (notification writes open their own
    // tenant context, which must not nest inside this one).
    if (!result.duplicate) {
      onNotificationEvent(tenantId, "EMAILS_READY_FOR_REVIEW", {
        userId,
        prospectName: v.business,
        deduplicationSuffix: `lead-${leadKeyForImport(v.business, v.email)}`,
      });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if ((e as any).status === 402) return NextResponse.json({ error: "ENTITLEMENT_REQUIRED", detail: "Start your 2-day proof or lease to import prospects." }, { status: 402 });
    return NextResponse.json({ error: "internal", detail: "Could not import prospect. Please retry." }, { status: 500 });
  }
}
