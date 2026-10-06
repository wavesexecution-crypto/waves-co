import { auth } from "@/lib/auth";
import { getEntitlement, hasCommercialAccess } from "@/lib/billing";
import Link from "next/link";
import { Button } from "@/components/button";
import { Container, Section } from "@/components/container";
import { Reveal } from "@/components/reveal";

export const dynamic = "force-dynamic";

interface Lead {
  id: string;
  company: string;
  person: string;
  role: string;
  website: string;
  reason: string;
  score: number;
  status: "pending" | "approved" | "rejected";
}

const mockLeads: Lead[] = [
  {
    id: "1",
    company: "Acme Corp",
    person: "Sarah Chen",
    role: "VP Marketing",
    website: "acme.com",
    reason: "Recently raised Series B, hiring marketing team, uses competitor tools",
    score: 92,
    status: "pending",
  },
  {
    id: "2",
    company: "TechStart Inc",
    person: "Marcus Johnson",
    role: "CTO",
    website: "techstart.io",
    reason: "Scaling engineering team, mentioned pain points in blog post",
    score: 87,
    status: "pending",
  },
  {
    id: "3",
    company: "GlobalLogistics",
    person: "Emily Rodriguez",
    role: "Head of Operations",
    website: "globallogistics.com",
    reason: "Expanding to new markets, current vendor contract ending Q2",
    score: 81,
    status: "pending",
  },
  {
    id: "4",
    company: "FinanceFlow",
    person: "David Park",
    role: "VP Finance",
    website: "financeflow.com",
    reason: "Manual processes causing delays, evaluating automation",
    score: 78,
    status: "approved",
  },
  {
    id: "5",
    company: "EduTech Solutions",
    person: "Lisa Wang",
    role: "CMO",
    website: "edtechsolutions.com",
    reason: "Budget increased 40% YoY, launching new product line",
    score: 74,
    status: "pending",
  },
  {
    id: "6",
    company: "HealthFirst",
    person: "James Miller",
    role: "CTO",
    website: "healthfirst.org",
    reason: "Legacy system migration, compliance requirements",
    score: 69,
    status: "rejected",
  },
];

export default async function LeadsPage() {
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
              Start your 2-Day Proof first
            </h1>
            <p className="mt-4 text-lg leading-[1.6] text-body">
              You need an active lease to review leads. Start a free 2-day proof to see how Acquisition OS works.
            </p>
            <Button href="/acquisition/onboarding" className="mt-8 w-full sm:w-auto" size="lg">
              Start 2-Day Proof
            </Button>
          </div>
        </Reveal>
      </Container>
    );
  }

  const pendingLeads = mockLeads.filter((l) => l.status === "pending");
  const approvedLeads = mockLeads.filter((l) => l.status === "approved");
  const rejectedLeads = mockLeads.filter((l) => l.status === "rejected");

  return (
    <Container className="py-8">
      {/* Header */}
      <Reveal className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Leads</p>
            <h1 className="mt-2 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
              Review your customers
            </h1>
            <p className="mt-2 text-sm text-body">
              {pendingLeads.length} waiting for your decision
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/acquisition/outreach">
              <Button variant="secondary">Outreach →</Button>
            </Link>
          </div>
        </div>
      </Reveal>

      {/* Tabs */}
      <Reveal delay={0.05} className="mb-6">
        <div className="flex gap-1 bg-paper/50 rounded-lg p-1" role="tablist">
          <button
            role="tab"
            aria-selected={true}
            className="px-4 py-2 text-sm font-medium text-navy rounded-md bg-white"
          >
            Pending ({pendingLeads.length})
          </button>
          <button
            role="tab"
            aria-selected={false}
            className="px-4 py-2 text-sm font-medium text-muted rounded-md hover:text-body transition-colors"
          >
            Approved ({approvedLeads.length})
          </button>
          <button
            role="tab"
            aria-selected={false}
            className="px-4 py-2 text-sm font-medium text-muted rounded-md hover:text-body transition-colors"
          >
            Rejected ({rejectedLeads.length})
          </button>
        </div>
      </Reveal>

      {/* Pending Leads */}
      <Reveal delay={0.1}>
        {pendingLeads.length === 0 ? (
          <div className="rounded-lg border border-line bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/20">
              <SearchIcon className="h-8 w-8 text-muted" />
            </div>
            <h3 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy">
              No leads waiting
            </h3>
            <p className="mt-2 text-sm text-body">
              All caught up! New leads will appear here as Acquisition OS finds them.
            </p>
            <Button href="/acquisition" variant="secondary" className="mt-6">
              Back to Home
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingLeads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        )}
      </Reveal>

      {/* Approved Leads */}
      <Reveal delay={0.15} className="mt-12">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent mb-4">Approved</h2>
        <div className="space-y-3">
          {approvedLeads.map((lead) => (
            <ApprovedLeadRow key={lead.id} lead={lead} />
          ))}
        </div>
      </Reveal>

      {/* Rejected Leads */}
      <Reveal delay={0.2} className="mt-8">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted mb-4">Rejected</h2>
        <div className="space-y-3">
          {rejectedLeads.map((lead) => (
            <RejectedLeadRow key={lead.id} lead={lead} />
          ))}
        </div>
      </Reveal>
    </Container>
  );
}

function LeadCard({ lead }: { lead: Lead }) {
  return (
    <div className="rounded-lg border border-line bg-white p-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-heading text-[18px] font-semibold tracking-[-0.01em] text-navy">
                {lead.company}
              </h3>
              <p className="mt-1 text-sm text-muted">{lead.website}</p>
            </div>
            <ScoreBadge score={lead.score} />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="px-2 py-0.5 rounded bg-navy/10 text-navy font-medium">{lead.person}</span>
            <span className="px-2 py-0.5 rounded bg-muted/50 text-muted">{lead.role}</span>
          </div>

          <p className="text-sm text-body">{lead.reason}</p>
        </div>

        <div className="flex flex-col gap-3 lg:ml-8">
          <Button className="w-full" onClick={() => approveLead(lead.id)}>
            Approve
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => rejectLead(lead.id)}>
            Reject
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => viewDetails(lead.id)}>
            View details
          </Button>
        </div>
      </div>
    </div>
  );
}

function ApprovedLeadRow({ lead }: { lead: Lead }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-success" />
          <div>
            <p className="font-medium text-navy">{lead.company}</p>
            <p className="text-sm text-muted">{lead.person} • {lead.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          <ScoreBadge score={lead.score} />
          <Button variant="ghost" size="sm" onClick={() => viewDetails(lead.id)}>
            View
          </Button>
        </div>
      </div>
    </div>
  );
}

function RejectedLeadRow({ lead }: { lead: Lead }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-error" />
          <div>
            <p className="font-medium text-muted">{lead.company}</p>
            <p className="text-sm text-muted">{lead.person} • {lead.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          <ScoreBadge score={lead.score} />
          <Button variant="ghost" size="sm" onClick={() => viewDetails(lead.id)}>
            View
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 80) return "bg-success/10 text-success";
    if (s >= 60) return "bg-accent/10 text-accent";
    return "bg-muted/50 text-muted";
  };

  return (
    <span className={`px-2 py-1 rounded font-mono text-xs font-semibold ${getColor(score)}`}>
      {score}% match
    </span>
  );
}

function approveLead(id: string) {
  console.log("Approve lead:", id);
  // TODO: Call API to approve lead
}

function rejectLead(id: string) {
  console.log("Reject lead:", id);
  // TODO: Call API to reject lead
}

function viewDetails(id: string) {
  console.log("View details:", id);
  // TODO: Open detail modal
}

// Icons
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}