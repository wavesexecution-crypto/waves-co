/**
 * Deterministic cycle metrics. Every number in a Cycle Report comes from
 * these COUNT/GROUP queries — the AI narrative may restate them but never
 * invent new ones (enforced by numbersSubsetCheck in lib/ai-operations.ts).
 *
 * Honesty rules:
 * - SENT/ACCEPTED = provider accepted (Resend ok). DELIVERED appears only
 *   when provider evidence exists (deliveryStatus DELIVERED rows); otherwise
 *   delivered=0 with deliveredKnown=false and the UI must say "unknown".
 * - Message-variant comparison uses only recorded per-send variant + replies.
 * - Target comparison groups by stored lead category (no invented segments).
 */
export interface CycleMetrics {
  cycleId: string;
  cycleNumber: number;
  period: { startedAt: string | null; closedAt: string | null };
  prospectsContacted: number;
  emailsAccepted: number;
  delivered: number;
  deliveredKnown: boolean;
  replies: number;
  positiveReplies: number;
  qualifiedOpportunities: number;
  replyRate: number;
  positiveRate: number;
  targets: Array<{ category: string; sent: number; replies: number; positive: number; replyRate: number }>;
  variants: Array<{ templateVersion: number | null; messageVariant: string | null; sent: number; replies: number; replyRate: number }>;
  generatedAt: string;
}

const rate = (num: number, den: number): number => (den > 0 ? Math.round((num / den) * 1000) / 1000 : 0);

export async function computeCycleMetrics(tx: any, tenantId: string, cycle: any): Promise<CycleMetrics> {
  const orders: any[] = await tx.outreachOrder.findMany({
    where: { tenantId, cycleId: cycle.id },
    select: { id: true, leadKey: true, status: true, deliveryStatus: true, replyStatus: true, templateVersion: true, messageVariant: true },
  });
  const sent = orders.filter((o: any) => o.status === "SENT" || o.status === "DELIVERED");
  const deliveredRows = orders.filter((o: any) => o.deliveryStatus === "DELIVERED" || o.status === "DELIVERED");
  const replied = orders.filter((o: any) => o.replyStatus);
  const positive = orders.filter((o: any) => o.replyStatus === "INTERESTED");

  // Targets: deterministic grouping by stored lead category.
  const leadKeySet = new Set<string>();
  for (const o of orders) {
    if (typeof o?.leadKey === "string" && o.leadKey.length > 0) leadKeySet.add(o.leadKey);
  }
  const leadKeys: string[] = [...leadKeySet];
  const research: any[] = leadKeys.length
    ? await tx.leadResearch.findMany({ where: { tenantId, leadKey: { in: leadKeys } }, select: { leadKey: true, category: true } })
    : [];
  const catOf = new Map<string, string>();
  for (const r of research) {
    catOf.set(String(r?.leadKey ?? ""), String(r?.category || "uncategorized"));
  }
  const byCat = new Map<string, { sent: number; replies: number; positive: number }>();
  for (const o of sent) {
    const cat = catOf.get(o.leadKey) ?? "uncategorized";
    const e = byCat.get(cat) ?? { sent: 0, replies: 0, positive: 0 };
    e.sent += 1;
    if (o.replyStatus) e.replies += 1;
    if (o.replyStatus === "INTERESTED") e.positive += 1;
    byCat.set(cat, e);
  }
  const targets = [...byCat.entries()]
    .map(([category, e]) => ({ category, ...e, replyRate: rate(e.replies, e.sent) }))
    .sort((a, b) => b.sent - a.sent);

  // Message variants: deterministic grouping by recorded per-send version.
  const byVar = new Map<string, { templateVersion: number | null; messageVariant: string | null; sent: number; replies: number }>();
  for (const o of sent) {
    const k = `${o.templateVersion ?? "na"}|${o.messageVariant ?? "default"}`;
    const e = byVar.get(k) ?? { templateVersion: o.templateVersion ?? null, messageVariant: o.messageVariant ?? null, sent: 0, replies: 0 };
    e.sent += 1;
    if (o.replyStatus) e.replies += 1;
    byVar.set(k, e);
  }
  const variants = [...byVar.values()]
    .map((e) => ({ ...e, replyRate: rate(e.replies, e.sent) }))
    .sort((a, b) => b.sent - a.sent);

  return {
    cycleId: cycle.id,
    cycleNumber: cycle.cycleNumber,
    period: { startedAt: cycle.startedAt ? new Date(cycle.startedAt).toISOString() : null, closedAt: cycle.closedAt ? new Date(cycle.closedAt).toISOString() : null },
    prospectsContacted: sent.length,
    emailsAccepted: sent.length,
    delivered: deliveredRows.length,
    deliveredKnown: deliveredRows.length > 0,
    replies: replied.length,
    positiveReplies: positive.length,
    qualifiedOpportunities: positive.length,
    replyRate: rate(replied.length, sent.length),
    positiveRate: rate(positive.length, sent.length),
    targets,
    variants,
    generatedAt: new Date().toISOString(),
  };
}
