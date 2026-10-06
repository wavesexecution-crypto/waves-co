import { auth } from "@/lib/auth";
import { getEntitlement, hasCommercialAccess } from "@/lib/billing";
import Link from "next/link";
import { Button } from "@/components/button";
import { Container, Section } from "@/components/container";
import { Reveal } from "@/components/reveal";

export const dynamic = "force-dynamic";

interface Reply {
  id: string;
  from: { name: string; role: string; company: string; email: string };
  subject: string;
  body: string;
  receivedAt: string;
  category: "interested" | "not-interested" | "follow-up" | "other";
  hasReplied: boolean;
}

const mockReplies: Reply[] = [
  {
    id: "1",
    from: { name: "Sarah Chen", role: "VP Marketing", company: "Acme Corp", email: "sarah@acme.com" },
    subject: "Re: Ideas for Acme's Q2 marketing push",
    body: `Hi there,

Thanks for reaching out. This is actually timely — we're finalizing our Q2 plan next week and I'm looking at a few options.

Could you send me a brief overview of how you've helped other Series B companies? Particularly interested in the "40% waste" metric you mentioned.

Best,
Sarah`,
    receivedAt: "2026-10-05T10:30:00Z",
    category: "interested",
    hasReplied: false,
  },
  {
    id: "2",
    from: { name: "Marcus Johnson", role: "CTO", company: "TechStart Inc", email: "marcus@techstart.io" },
    subject: "Re: Technical debt at TechStart?",
    body: `Interesting angle. We've tried a few static analysis tools but they just create noise.

What makes your approach different? Happy to hop on a quick call if you have a demo.

-Marcus`,
    receivedAt: "2026-10-05T09:15:00Z",
    category: "interested",
    hasReplied: false,
  },
  {
    id: "3",
    from: { name: "Emily Rodriguez", role: "Head of Operations", company: "GlobalLogistics", email: "emily@globallogistics.com" },
    subject: "Re: Q2 expansion planning",
    body: `Thanks but we're already working with a vendor for this transition. Not looking to add more partners right now.

Best,
Emily`,
    receivedAt: "2026-10-04T16:45:00Z",
    category: "not-interested",
    hasReplied: false,
  },
  {
    id: "4",
    from: { name: "David Park", role: "VP Finance", company: "FinanceFlow", email: "david@financeflow.com" },
    subject: "Re: Automating FinanceFlow's reconciliation",
    body: `15 hours/week sounds about right for our team. What's the implementation timeline and cost structure?

Also, does it integrate with NetSuite?

Thanks,
David`,
    receivedAt: "2026-10-04T14:20:00Z",
    category: "interested",
    hasReplied: false,
  },
  {
    id: "5",
    from: { name: "Lisa Wang", role: "CMO", company: "EduTech Solutions", email: "lisa@edtechsolutions.com" },
    subject: "Re: New product launch support",
    body: `Appreciate the note. We have an internal team handling launch. Will keep you in mind for future campaigns.

Regards,
Lisa`,
    receivedAt: "2026-10-03T11:00:00Z",
    category: "not-interested",
    hasReplied: false,
  },
  {
    id: "6",
    from: { name: "James Miller", role: "CTO", company: "HealthFirst", email: "james@healthfirst.org" },
    subject: "Re: Legacy system migration",
    body: `Not interested. We're handling this internally.

Please remove from your list.`,
    receivedAt: "2026-10-03T08:30:00Z",
    category: "not-interested",
    hasReplied: false,
  },
];

const categories = [
  { id: "all", label: "All", count: mockReplies.length },
  { id: "interested", label: "Interested", count: mockReplies.filter(r => r.category === "interested").length },
  { id: "not-interested", label: "Not interested", count: mockReplies.filter(r => r.category === "not-interested").length },
  { id: "follow-up", label: "Follow up", count: mockReplies.filter(r => r.category === "follow-up").length },
  { id: "other", label: "Other", count: mockReplies.filter(r => r.category === "other").length },
] as const;

export default async function RepliesPage() {
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
              {categories[1].count} interested • {categories[2].count} not interested
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/acquisition/outreach">
              <Button variant="secondary">← Outreach</Button>
            </Link>
            <Link href="/acquisition/results">
              <Button variant="secondary">Results →</Button>
            </Link>
          </div>
        </div>
      </Reveal>

      {/* Category Tabs */}
      <Reveal delay={0.05} className="mb-6">
        <div className="flex flex-wrap gap-2 bg-paper/50 rounded-lg p-1" role="tablist">
          {categories.map((cat) => (
            <button
              key={cat.id}
              role="tab"
              aria-selected={cat.id === "all"}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                cat.id === "all"
                  ? "bg-white text-navy"
                  : "text-muted hover:text-body"
              }`}
            >
              {cat.label} <span className="ml-1 font-mono text-[10px] text-muted">({cat.count})</span>
            </button>
          ))}
        </div>
      </Reveal>

      {/* Reply List */}
      <Reveal delay={0.1}>
        <div className="space-y-3">
          {mockReplies.map((reply) => (
            <ReplyCard key={reply.id} reply={reply} />
          ))}
        </div>
      </Reveal>

      {/* Empty State */}
      <Reveal delay={0.15} className="mt-8 hidden">
        <div className="rounded-lg border border-line bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/20">
            <MailIcon className="h-8 w-8 text-muted" />
          </div>
          <h3 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy">
            No replies yet
          </h3>
          <p className="mt-2 text-sm text-body">
            Replies will appear here when prospects respond to your outreach.
          </p>
        </div>
      </Reveal>
    </Container>
  );
}

function ReplyCard({ reply }: { reply: Reply }) {
  const categoryColors: Record<string, { dot: string; badge: string; label: string }> = {
    interested: { dot: "bg-success", badge: "bg-success/10 text-success", label: "Interested" },
    "not-interested": { dot: "bg-error", badge: "bg-error/10 text-error", label: "Not interested" },
    "follow-up": { dot: "bg-accent", badge: "bg-accent/10 text-accent", label: "Follow up" },
    other: { dot: "bg-muted", badge: "bg-muted/50 text-muted", label: "Other" },
  };

  const colors = categoryColors[reply.category] || categoryColors.other;

  return (
    <div className="rounded-lg border border-line bg-white p-5 hover:border-accent/50 transition-colors">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`h-2 w-2 rounded-full ${colors.dot}`} />
              <div>
                <p className="font-medium text-navy">{reply.from.name}</p>
                <p className="text-sm text-muted">{reply.from.role} @ {reply.from.company}</p>
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

          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted">
              {new Date(reply.receivedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
            <div className="flex items-center gap-2">
              {!reply.hasReplied && (
                <Button size="sm" onClick={() => replyTo(reply.id)}>
                  Reply
                </Button>
              )}
              {reply.hasReplied && (
                <span className="px-2 py-1 rounded bg-success/10 text-success text-xs font-medium">Replied</span>
              )}
              <Button variant="ghost" size="sm" onClick={() => markNotInterested(reply.id)}>
                Not interested
              </Button>
            </div>
          </div>
        </div>

        <div className="lg:ml-8 flex flex-col gap-2">
          {!reply.hasReplied && (
            <Button className="w-full" onClick={() => replyTo(reply.id)}>
              <MailIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              Reply
            </Button>
          )}
          <Button variant="secondary" className="w-full" onClick={() => scheduleFollowUp(reply.id)}>
            Follow up
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => viewDetails(reply.id)}>
            View details
          </Button>
        </div>
      </div>
    </div>
  );
}

function replyTo(id: string) {
  console.log("Reply to:", id);
  // TODO: Open reply composer
}

function markNotInterested(id: string) {
  console.log("Mark not interested:", id);
  // TODO: Call API
}

function scheduleFollowUp(id: string) {
  console.log("Schedule follow-up:", id);
  // TODO: Open follow-up scheduler
}

function viewDetails(id: string) {
  console.log("View details:", id);
  // TODO: Open detail modal
}

// Icons
function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}