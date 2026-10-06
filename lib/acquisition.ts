/**
 * Acquisition OS — application workflow backend (server-side).
 *
 * Covers the real customer journey on top of the existing Prisma tables:
 *   profile (AcquisitionProfile) → leads (LeadResearch + OutreachOrder)
 *   → outreach decisions/sending → follow-ups → truthful stats.
 *
 * SECURITY CONTRACT (OS2 P7):
 * - tenantId is ALWAYS derived from the authenticated session, never from
 *   the request body/query. Every helper that touches the DB takes an
 *   explicit tenantId resolved server-side from `auth()`.
 * - Commercial actions (import, decide, send, follow-ups) require
 *   `requireCommercialAccess()` (valid TRIAL or ACTIVE lease).
 * - Pure helpers below are unit-tested without a database.
 */

import { z } from "zod";
import { withTenantContext } from "./context";

// ─── Profile (onboarding → AcquisitionProfile) ──────────────────────────

export const ProfileSubmitSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(200),
  website: z
    .string()
    .trim()
    .max(200)
    .optional()
    .default("")
    .transform((v) => v || null),
  industry: z.string().trim().min(1, "Business type is required").max(100),
  businessModel: z.string().trim().max(100).nullish(),
  targetQuantity: z.number().int().positive().max(100000).nullish(),
  targetTimeframe: z.string().trim().max(100).nullish(),
  icp: z
    .object({
      companySize: z.string().max(50).nullish(),
      roles: z.array(z.string().max(100)).max(30).default([]),
      industries: z.array(z.string().max(100)).max(30).default([]),
      locations: z.string().max(500).nullish(),
      painPoints: z.string().max(2000).nullish(),
    })
    .default({ roles: [], industries: [] }),
  offer: z
    .object({
      whatWeSell: z.string().max(2000).nullish(),
    })
    .nullish(),
});

export type ProfileSubmit = z.infer<typeof ProfileSubmitSchema>;

// ─── Leads (LeadResearch + OutreachOrder pipeline) ──────────────────────

/** Statuses an OutreachOrder can be decided into from the review queue. */
export const LEAD_DECISIONS = ["APPROVED", "REJECTED"] as const;
export type LeadDecision = (typeof LEAD_DECISIONS)[number];

/** Order statuses shown in the review queue. */
export const REVIEWABLE_STATUSES = ["READY_FOR_APPROVAL"] as const;

/** Terminal outreach-order statuses — no further transitions allowed. */
export const TERMINAL_ORDER_STATUSES = ["SENT", "DELIVERED", "FAILED", "REJECTED", "CANCELLED"] as const;

export const LeadImportSchema = z.object({
  business: z.string().trim().min(1, "Business name is required").max(200),
  contactName: z.string().trim().max(200).nullish(),
  contactRole: z.string().trim().max(200).nullish(),
  email: z.string().trim().email("Enter a valid email address").max(320),
  website: z.string().trim().max(300).nullish(),
  city: z.string().trim().max(200).nullish(),
  area: z.string().trim().max(200).nullish(),
  category: z.string().trim().max(200).nullish(),
  opportunity: z.string().trim().max(2000).nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

export type LeadImport = z.infer<typeof LeadImportSchema>;

export const LeadDecisionSchema = z.object({
  orderId: z.string().min(1, "orderId is required").max(100),
  decision: z.enum(LEAD_DECISIONS),
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Deterministic per-tenant lead key for customer-supplied prospects.
 * Same (business, email) in one tenant → same key (safe re-import);
 * different tenants → different keys (no cross-tenant collisions).
 */
export function leadKeyForImport(business: string, email: string): string {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return `import:${norm(business)}:${norm(email)}`;
}

/** Draft outreach copy derived from stored research (no AI, no fabrication). */
export function draftOutreachForLead(input: {
  businessName: string;
  contactName?: string | null;
  opportunity?: string | null;
  companyName: string;
}): { subject: string; body: string } {
  const first = (input.contactName ?? "").trim().split(/\s+/)[0] || "there";
  const opp = (input.opportunity ?? "").trim();
  return {
    subject: `Ideas for ${input.businessName}`,
    body: [
      `Hi ${first},`,
      ``,
      opp
        ? `Noticed ${input.businessName} — ${opp}`
        : `Came across ${input.businessName} and thought this might be relevant.`,
      ``,
      `${input.companyName} helps teams like yours find and win customers without manual prospecting.`,
      ``,
      `Open to a 15-minute call to see if this fits?`,
    ].join("\n"),
  };
}

/**
 * Validate an order status transition. Returns null when allowed, else a
 * machine-readable reason. Terminal states never transition.
 */
export function validateOrderTransition(from: string, to: string): string | null {
  if ((TERMINAL_ORDER_STATUSES as readonly string[]).includes(from)) {
    return `Order is terminal (${from})`;
  }
  const allowed: Record<string, string[]> = {
    READY_FOR_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED"],
    PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
    APPROVED: ["SENT", "FAILED", "CANCELLED"],
  };
  if (!(allowed[from] ?? []).includes(to)) {
    return `Transition ${from} → ${to} not allowed`;
  }
  return null;
}

export function isValidLeadEmail(email: unknown): boolean {
  return typeof email === "string" && email.length <= 320 && EMAIL_RE.test(email.trim());
}

// ─── Follow-ups ─────────────────────────────────────────────────────────

export const FollowUpCreateSchema = z.object({
  orderId: z.string().min(1).max(100).nullish(),
  leadKey: z.string().min(1).max(300).nullish(),
  business: z.string().trim().min(1).max(200),
  note: z.string().trim().max(2000).nullish(),
  dueAt: z.string().datetime({ offset: true }).nullish(),
  channel: z.enum(["email", "call", "visit"]).default("email"),
});

export type FollowUpCreate = z.infer<typeof FollowUpCreateSchema>;

// ─── Stats (truthful aggregation over stored rows) ──────────────────────

export interface AcquisitionStats {
  leadsTotal: number;
  leadsReady: number;
  leadsApproved: number;
  leadsRejected: number;
  emailsSent: number;
  emailsFailed: number;
  replies: number;
  interested: number;
  followUpsPending: number;
  generatedAt: string;
}

export const EMPTY_STATS: AcquisitionStats = {
  leadsTotal: 0,
  leadsReady: 0,
  leadsApproved: 0,
  leadsRejected: 0,
  emailsSent: 0,
  emailsFailed: 0,
  replies: 0,
  interested: 0,
  followUpsPending: 0,
  generatedAt: new Date(0).toISOString(),
};

/** Order groups for the review queue (mirrors the leads/outreach APIs). */
export const ORDER_GROUPS: Record<string, string[]> = {
  ready: ["READY_FOR_APPROVAL", "PENDING"],
  approved: ["APPROVED", "SENT", "DELIVERED"],
  rejected: ["REJECTED", "CANCELLED", "FAILED"],
};

/** Pure aggregation — counts must always come from stored rows, never constants. */
export function buildStats(input: {
  ready: number;
  approved: number;
  rejected: number;
  sent: number;
  failed: number;
  replies: number;
  interested: number;
  followUpsPending: number;
}): AcquisitionStats {
  const nums = [input.ready, input.approved, input.rejected, input.sent, input.failed, input.replies, input.interested, input.followUpsPending];
  if (!nums.every((n) => Number.isInteger(n) && n >= 0)) {
    throw new Error("Stat counts must be non-negative integers");
  }
  return {
    leadsTotal: input.ready + input.approved + input.rejected,
    leadsReady: input.ready,
    leadsApproved: input.approved,
    leadsRejected: input.rejected,
    emailsSent: input.sent,
    emailsFailed: input.failed,
    replies: input.replies,
    interested: input.interested,
    followUpsPending: input.followUpsPending,
    generatedAt: new Date().toISOString(),
  };
}

// --- Server data access (tenant-scoped, for server components) ---------
// These open their own tenant transaction; never call them inside another
// withTenantContext callback. tenantId always comes from auth() in the page.

export interface TenantLeadRow {
  id: string; leadKey: string; version: number; businessName: string;
  contactName: string | null; contactRole: string | null; email: string;
  subject: string; body: string; opportunity: string | null; status: string;
  decidedAt: Date | null; sentAt: Date | null; sendError: string | null;
  createdAt: Date; updatedAt: Date;
}

export async function fetchTenantLeads(
  tenantId: string,
  opts: { statuses?: string[] | null; q?: string; page?: number; pageSize?: number } = {},
): Promise<{ leads: TenantLeadRow[]; total: number; counts: Record<string, number> }> {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 20));
  const q = (opts.q ?? "").trim().slice(0, 100);
  return withTenantContext(tenantId, async (tx: any) => {
    const where: any = { tenantId };
    if (opts.statuses) where.status = { in: opts.statuses };
    if (q) {
      where.OR = [
        { businessName: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }
    const [total, leads] = await Promise.all([
      tx.outreachOrder.count({ where }),
      tx.outreachOrder.findMany({
        where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
        select: {
          id: true, leadKey: true, version: true, businessName: true, contactName: true,
          contactRole: true, email: true, subject: true, body: true, opportunity: true,
          status: true, decidedAt: true, sentAt: true, sendError: true, createdAt: true, updatedAt: true,
        },
      }),
    ]);
    const counts: Record<string, number> = {};
    for (const [k, v] of Object.entries(ORDER_GROUPS)) {
      counts[k] = await tx.outreachOrder.count({ where: { tenantId, status: { in: v } } });
    }
    return { leads, total, counts };
  });
}

export async function fetchTenantStats(tenantId: string): Promise<AcquisitionStats> {
  return withTenantContext(tenantId, async (tx: any) => {
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
}
