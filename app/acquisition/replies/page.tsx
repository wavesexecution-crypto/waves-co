import { auth } from "@/lib/auth";
import { getEntitlement, hasCommercialAccess } from "@/lib/billing";
import { withTenantContext } from "@/lib/context";
import { requireCommercialAccess } from "@/lib/billing";
import Link from "next/link";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { Reveal } from "@/components/reveal";
import { FollowUpButton } from "./reply-actions";

export const dynamic = "force-dynamic";

interface StoredReply {
  id: string;
  leadKey: string;
  business: string;
  email: string;
  subject: string;
  body: string;
  replyStatus: string | null;
  updatedAt: Date;
}

const CATEGORIES = ["all", "interested", "not-interested", "follow-up", "other"] as const;

function categoryOf(replyStatus: string | null): string {
  const s = (replyStatus ?? "").toLowerCase().replace(/_/g, "-");
  if (s.includes("interest") && !s.includes("not")) return "interested";
  if (s.includes("not-interest") || s.includes("not-interested")) return "not-interested";
  if (s.includes("follow")) return "follow-up";
  return "other";
}

export default async function RepliesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const session = await auth();
  const user = session?.user;
  const tenantId = user?.tenantId as string | undefined;

  let hasAccess = false;
  if (tenantId) {
    try {
      const entitlement = await getEntitlement(tenantId);
      hasAccess = hasCommercialAccess(entitlement);
    } catch {
      hasAccess = false;
    }
  }

  if (!tenantId || !hasAccess) {
    return (
      <Container className="py-20 text-center">
        <Reveal>
          <div className="mx-auto max-w-xl">
            <h1 className="font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
              Lease required for replies
            </h1>
            <p className="mt-4 text-lg leading-[1.6] text-body">
              You need an active lease to view and respond to replies.
            </p>
            <Button href="/acquisition/billing" className="mt-8 w-full sm:w-auto" size="lg">
              View lease options
            </Button>
          </div>
        </Reveal>
      </Container>
    );
  }

  const sp = await searchParams;
  const rawCat = (sp.category ?? "all").toLowerCase();
  const category = (CATEGORIES as readonly string[]).includes(rawCat) ? rawCat : "all";

  let replies: StoredReply[] = [];
  let loadError: string | null = null;
  try {
    await requireCommercialAccess(tenantId);
    replies = await withTenantContext(tenantId, async (tx: any) =>
      tx.outreachEmail.findMany({
        where: { tenantId, replyStatus: { not: null } },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: { id: true, leadKey: true, business: true, email: true, subject: true, body: true, replyStatus: true, updatedAt: true },
      }),
    );
  } catch (e: any) {
    loadError = (e as any)?.status === 402 ? "Your proof or lease expired." : "Could not load replies. Please refresh to retry.";
  }

  const counts: Record<string, number> = { all: replies.length, interested: 0, "not-interested": 0, "follow-up": 0, other: 0 };
  for (const r of replies) counts[categoryOf(r.replyStatus)] = (counts[categoryOf(r.replyStatus)] ?? 0) + 1;
  const visible = category === "all" ? replies : replies.filter((r) => categoryOf(r.replyStatus) === category);

  // Primary action based on category
  const primaryAction = (() => {
    if (counts.interested > 0 && category === "interested") {
      return { label: `Reply to ${counts.interested} interested`, href: "/acquisition/replies?category=interested" };
    }
    if (counts["follow-up"] > 0) {
      return { label: `Follow up on ${counts["follow-up"]}`, href: "/acquisition/replies?category=follow-up" };
    }
    return { label: "View inbox", href: "/acquisition/replies" };
  })();

  return (
    <Container className="py-8">
      {/* Header */}
      <Reveal className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Replies</p>
            <h1 className="mt-2 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
              Your inbox
            </h1>
            <p className="mt-2 text-sm text-body">
              {counts.interested} interested · {counts["not-interested"]} not interested
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Link href="/acquisition/outreach">
              <Button variant="secondary">← Outreach</Button>
            </Link>
            <Link href="/acquisition/results">
              <Button variant="secondary">Reports →</Button>
            </Link>
          </div>
        </div>
      </Reveal>

      {/* Primary Action Banner */}
      <Reveal className="mb-6">
        <div className="rounded-lg border border-accent bg-accent/5 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Priority</p>
              <h2 className="mt-1 font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy sm:text-[28px]">
                {counts.interested > 0 ? `${counts.interested} interested prospects need your reply` : "No urgent replies"}
              </h2>
            </div>
            {counts.interested > 0 && (
              <Link href="/acquisition/replies?category=interested">
                <Button size="lg" className="w-full sm:w-auto">
                  Reply to interested
                </Button>
              </Link>
            )}
          </div>
        </div>
      </Reveal>

      {/* Category Tabs */}
      <Reveal delay={0.05} className="mb-6">
        <div className="flex flex-wrap gap-2 bg-paper/50 rounded-lg p-1" role="tablist">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              role="tab"
              aria-selected={cat === category}
              href={cat === "all" ? "/acquisition/replies" : `/acquisition/replies?category=${cat}`}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                cat === category ? "bg-white text-navy" : "text-muted hover:text-body"
              }`}
            >
              {cat === "all" ? "All" : cat === "not-interested" ? "Not interested" : cat === "follow-up" ? "Follow up" : cat[0].toUpperCase() + cat.slice(1)}{" "}
              <span className="ml-1 font-mono text-[10px] text-muted">({counts[cat] ?? 0})</span>
            </Link>
          ))}
        </div>
      </Reveal>

      {/* Reply List */}
      <Reveal delay={0.1}>
        {loadError ? (
          <div className="rounded-lg border border-line bg-white p-12 text-center">
            <p className="text-sm text-body">{loadError}</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-lg border border-line bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/20">
              <MailIcon className="h-8 w-8 text-muted" />
            </div>
            <h3 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy">
              No replies yet
            </h3>
            <p className="mt-2 text-sm text-body">
              Inbound capture is not connected yet. Replies from prospects arrive in the inbox you send
              from, and are not imported into this view automatically. Send history is on the Outreach page.
            </p>
            {counts.all === 0 && (
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/acquisition/outreach">
                  <Button variant="secondary">Send outreach first</Button>
                </Link>
                <Link href="/acquisition/leads">
                  <Button variant="secondary">Add prospects</Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((reply) => (
              <ReplyCard key={reply.id} reply={reply} />
            ))}
          </div>
        )}
      </Reveal>
    </Container>
  );
}

function ReplyCard({ reply }: { reply: StoredReply }) {
  const cat = categoryOf(reply.replyStatus);
  const categoryColors: Record<string, { dot: string; badge: string; label: string }> = {
    interested: { dot: "bg-success", badge: "bg-success/10 text-success", label: "Interested" },
    "not-interested": { dot: "bg-error", badge: "bg-error/10 text-error", label: "Not interested" },
    "follow-up": { dot: "bg-accent", badge: "bg-accent/10 text-accent", label: "Follow up" },
    other: { dot: "bg-muted", badge: "bg-muted/50 text-muted", label: reply.replyStatus ?? "Reply" },
  };

  const colors = categoryColors[cat] || categoryColors.other;

  return (
    <div className="rounded-lg border border-line bg-white p-5 hover:border-accent/50 transition-colors">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full ${colors.dot}`} />
              <div>
                <p className="font-medium text-navy">{reply.business}</p>
                <p className="text-sm text-muted">{reply.email}</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors.badge}`}>
              {colors.label}
            </span>
          </div>

          <p className="font-medium text-navy">{reply.subject}</p>

          <div className="bg-paper/50 rounded p-4 text-sm text-body leading-relaxed max-h-32 overflow-y-auto">
            {reply.body}
          </div>

          <span className="font-mono text-[10px] text-muted">
            {new Date(reply.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {/* Actions prominently displayed */}
        <div className="lg:ml-8 flex flex-col gap-2">
          <FollowUpButton leadKey={reply.leadKey} business={reply.business} />
          <Link href={`/acquisition/replies?category=${cat}#${reply.id}`}>
            <Button variant="ghost" className="w-full">View thread</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}