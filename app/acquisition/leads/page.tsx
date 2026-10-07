import { auth } from "@/lib/auth";
import { getEntitlement, hasCommercialAccess } from "@/lib/billing";
import { ORDER_GROUPS, fetchTenantLeads, type TenantLeadRow } from "@/lib/acquisition";
import Link from "next/link";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { Reveal } from "@/components/reveal";
import { LeadDecisionButtons, LeadImportForm } from "./lead-actions";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "ready", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
] as const;

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
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

  const sp = await searchParams;
  const tab = sp.status === "approved" || sp.status === "rejected" ? sp.status : "ready";
  const q = (sp.q ?? "").trim().slice(0, 100);

  let leads: TenantLeadRow[] = [];
  let total = 0;
  let counts = { ready: 0, approved: 0, rejected: 0 };
  let loadError: string | null = null;
  try {
    const r = await fetchTenantLeads(tenantId, { statuses: [...ORDER_GROUPS[tab]], q });
    leads = r.leads;
    total = r.total;
    counts = { ready: r.counts.ready ?? 0, approved: r.counts.approved ?? 0, rejected: r.counts.rejected ?? 0 };
  } catch {
    loadError = "Could not load your leads. Please refresh to retry.";
  }

  const tabCount = (id: string) => (id === "ready" ? counts.ready : id === "approved" ? counts.approved : counts.rejected);
  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    p.set("status", extra.status ?? tab);
    const qq = extra.q ?? q;
    if (qq) p.set("q", qq);
    return `/acquisition/leads?${p.toString()}`;
  };

  return (
    <Container className="py-8">
      {/* Header */}
      <Reveal className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Leads</p>
            <h1 className="mt-2 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
              Review your prospects
            </h1>
            <p className="mt-2 text-sm text-body">
              {counts.ready} waiting for your decision
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <LeadImportForm />
            <Link href="/acquisition/outreach">
              <Button variant="secondary">Outreach →</Button>
            </Link>
          </div>
        </div>
      </Reveal>

      {/* Search */}
      <Reveal className="mb-6">
        <form action="/acquisition/leads" method="get" className="flex gap-3">
          <input type="hidden" name="status" value={tab} />
          <div className="flex-1">
            <label htmlFor="search" className="sr-only">Search leads</label>
            <input
              id="search"
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search business, contact, email"
              maxLength={100}
              className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy"
            />
          </div>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </Reveal>

      {/* Tabs */}
      <Reveal delay={0.05} className="mb-6">
        <div className="flex gap-1 bg-paper/50 rounded-lg p-1" role="tablist">
          {TABS.map((t) => (
            <Link
              key={t.id}
              role="tab"
              aria-selected={t.id === tab}
              href={qs({ status: t.id })}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                t.id === tab ? "text-navy bg-white" : "text-muted hover:text-body"
              }`}
            >
              {t.label} ({tabCount(t.id)})
            </Link>
          ))}
        </div>
      </Reveal>

      {/* List */}
      <Reveal delay={0.1}>
        {loadError ? (
          <div className="rounded-lg border border-line bg-white p-12 text-center">
            <h3 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy">
              Couldn&apos;t load leads
            </h3>
            <p className="mt-2 text-sm text-body">{loadError}</p>
            <Button href="/acquisition/leads" variant="secondary" className="mt-6">
              Retry
            </Button>
          </div>
        ) : total === 0 && counts.ready + counts.approved + counts.rejected === 0 ? (
          <div className="rounded-lg border border-line bg-white p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted/20">
              <SearchIcon className="h-8 w-8 text-muted" />
            </div>
            <h3 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy">
              No prospects yet
            </h3>
            <p className="mt-2 text-sm text-body">
              Add prospects above and they will appear here for your review. Nothing is fabricated — this list shows only what you added.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <LeadImportForm />
              <Button href="/acquisition/onboarding" variant="secondary">
                Complete setup
              </Button>
            </div>
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-lg border border-line bg-white p-12 text-center">
            <h3 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy">
              Nothing here
            </h3>
            <p className="mt-2 text-sm text-body">
              No leads match this view. Try another tab or search.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {leads.map((lead) => (
              tab === "ready" ? <LeadCard key={lead.id} lead={lead} /> : <DecidedLeadRow key={lead.id} lead={lead} />
            ))}
          </div>
        )}
      </Reveal>

      {/* Totals for other queues */}
      {tab === "ready" && (counts.approved > 0 || counts.rejected > 0) && (
        <Reveal delay={0.15} className="mt-12">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent mb-4">
            Decided — {counts.approved} approved · {counts.rejected} rejected
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href={qs({ status: "approved" })}>
              <Button variant="secondary">View approved</Button>
            </Link>
            <Link href={qs({ status: "rejected" })}>
              <Button variant="secondary">View rejected</Button>
            </Link>
          </div>
        </Reveal>
      )}
    </Container>
  );
}

function LeadCard({ lead }: { lead: TenantLeadRow }) {
  return (
    <div className="rounded-lg border border-line bg-white p-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-heading text-[18px] font-semibold tracking-[-0.01em] text-navy">
                {lead.businessName}
              </h3>
              <p className="mt-1 text-sm text-muted">{lead.email}</p>
            </div>
            <span className="px-2 py-1 rounded font-mono text-xs font-semibold bg-muted/50 text-muted">
              {lead.status.replace(/_/g, " ")}
            </span>
          </div>

          {(lead.contactName || lead.contactRole) && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {lead.contactName && <span className="px-2 py-0.5 rounded bg-navy/10 text-navy font-medium">{lead.contactName}</span>}
              {lead.contactRole && <span className="px-2 py-0.5 rounded bg-muted/50 text-muted">{lead.contactRole}</span>}
            </div>
          )}

          {lead.opportunity && <p className="text-sm text-body">{lead.opportunity}</p>}

          <details className="rounded-md border border-line bg-paper/50 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-navy">View stored outreach draft</summary>
            <p className="mt-2 text-sm font-medium text-navy">{lead.subject}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-body">{lead.body}</p>
          </details>
        </div>

        {/* Primary actions - always visible and prominent */}
        <div className="flex flex-col gap-3 lg:ml-8">
          <LeadDecisionButtons orderId={lead.id} />
        </div>
      </div>
    </div>
  );
}

function DecidedLeadRow({ lead }: { lead: TenantLeadRow }) {
  const approved = lead.status === "APPROVED" || lead.status === "SENT" || lead.status === "DELIVERED";
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${approved ? "bg-success" : "bg-error"}`} />
          <div>
            <p className={`font-medium ${approved ? "text-navy" : "text-muted"}`}>{lead.businessName}</p>
            <p className="text-sm text-muted">
              {[lead.contactName, lead.contactRole].filter(Boolean).join(" • ") || lead.email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="font-mono text-xs">{lead.status.replace(/_/g, " ")}</span>
          {lead.sentAt && <span className="font-mono text-xs">sent {new Date(lead.sentAt).toLocaleDateString()}</span>}
        </div>
      </div>
    </div>
  );
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