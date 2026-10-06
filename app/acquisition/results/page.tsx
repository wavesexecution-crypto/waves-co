import { auth } from "@/lib/auth";
import { getEntitlement, hasCommercialAccess } from "@/lib/billing";
import { fetchTenantStats } from "@/lib/acquisition";
import Link from "next/link";
import { Button } from "@/components/button";
import { Container, Section } from "@/components/container";
import { Reveal } from "@/components/reveal";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

function pct(num: number, den: number): string {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return "0";
  return ((num / den) * 100).toFixed(1);
}

export default async function ResultsPage() {
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
              Lease required for results
            </h1>
            <p className="mt-4 text-lg leading-[1.6] text-body">
              You need an active lease to view your acquisition results.
            </p>
            <Button href="/acquisition/billing" className="mt-8 w-full sm:w-auto" size="lg">
              View lease options
            </Button>
          </div>
        </Reveal>
      </Container>
    );
  }

  // Real counts from stored rows — never constants. Zeros are honest for
  // new workspaces; every figure below derives from these counts.
  let stats = null as null | Awaited<ReturnType<typeof fetchTenantStats>>;
  let loadError: string | null = null;
  if (tenantId) {
    try {
      stats = await fetchTenantStats(tenantId);
    } catch {
      loadError = "Could not load your report. Please refresh to retry.";
    }
  }
  if (loadError || !stats) {
    return (
      <Container className="py-20 text-center">
        <Reveal>
          <div className="mx-auto max-w-xl">
            <h1 className="font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
              Report unavailable
            </h1>
            <p className="mt-4 text-lg leading-[1.6] text-body">{loadError ?? "Sign in to view your report."}</p>
            <Button href="/acquisition/results" className="mt-8 w-full sm:w-auto" size="lg">
              Retry
            </Button>
          </div>
        </Reveal>
      </Container>
    );
  }

  const results = {
    period: "All time",
    prospects: stats.leadsTotal,
    awaitingDecision: stats.leadsReady,
    peopleContacted: stats.emailsSent,
    failedSends: stats.emailsFailed,
    replies: stats.replies,
    interested: stats.interested,
    followUpsPending: stats.followUpsPending,
  };

  const conversionRate = pct(results.interested, results.replies);
  const replyRate = pct(results.replies, results.peopleContacted);

  // Determine primary next action
  const primaryAction = (() => {
    if (results.interested > 0) {
      return { label: `Reply to ${results.interested} interested`, href: "/acquisition/replies?category=interested", description: "Prospects are waiting for your response" };
    }
    if (results.replies > 0) {
      return { label: "View replies", href: "/acquisition/replies", description: `${results.replies} replies received` };
    }
    if (results.peopleContacted > 0) {
      return { label: "Check for replies", href: "/acquisition/replies", description: `${results.peopleContacted} emails sent, waiting for responses` };
    }
    if (results.awaitingDecision > 0) {
      return { label: "Review leads", href: "/acquisition/leads", description: `${results.awaitingDecision} prospects awaiting decision` };
    }
    if (results.prospects > 0) {
      return { label: "Start outreach", href: "/acquisition/outreach", description: "Send emails to approved prospects" };
    }
    return { label: "Add prospects", href: "/acquisition/onboarding", description: "Set up your first acquisition cycle" };
  })();

  return (
    <Container className="py-8">
      {/* Header */}
      <Reveal className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Reports</p>
            <h1 className="mt-2 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
              Your acquisition report
            </h1>
            <p className="mt-2 text-sm text-body">
              {results.period} • Updated today
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/acquisition/replies">
              <Button variant="secondary">← Replies</Button>
            </Link>
            <PrintButton />
          </div>
        </div>
      </Reveal>

      {/* Primary Next Action */}
      <Reveal className="mb-10">
        <div className="rounded-lg border border-accent bg-accent/5 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Your next step</p>
              <h2 className="mt-1 font-heading text-[28px] font-semibold tracking-[-0.01em] text-navy sm:text-[36px]">
                {primaryAction.label}
              </h2>
              <p className="mt-1 text-sm text-body">{primaryAction.description}</p>
            </div>
            <Link href={primaryAction.href}>
              <Button size="lg" className="w-full sm:w-auto shrink-0">
                {primaryAction.label}
              </Button>
            </Link>
          </div>
        </div>
      </Reveal>

      {/* Key Numbers - Business Language First */}
      <Reveal delay={0.05} className="mb-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BigNumberCard
            label="Prospects added"
            value={results.prospects.toLocaleString()}
            description={`${results.awaitingDecision} awaiting decision`}
            icon={<UsersIcon />}
          />
          <BigNumberCard
            label="People contacted"
            value={results.peopleContacted.toLocaleString()}
            description={results.failedSends > 0 ? `${results.failedSends} failed to send` : `${replyRate}% replied`}
            icon={<ReplyIcon />}
          />
          <BigNumberCard
            label="Replies received"
            value={results.replies.toLocaleString()}
            description={`${conversionRate}% showed interest`}
            icon={<HeartIcon />}
          />
          <BigNumberCard
            label="Follow-ups pending"
            value={results.followUpsPending.toLocaleString()}
            description={`${results.interested} interested prospects`}
            icon={<DollarIcon />}
          />
        </div>
      </Reveal>

      {/* What happened - Plain English */}
      <Reveal delay={0.1} className="mb-12">
        <Section className="py-0">
          <h2 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy mb-6">
            What happened
          </h2>
          <div className="space-y-4">
            <PlainEnglishRow
              icon={<CheckCircleIcon />}
              title={`${results.prospects} prospects in your workspace (${results.awaitingDecision} awaiting decision)`}
              detail="Only prospects you added are counted — nothing here is fabricated"
            />
            <PlainEnglishRow
              icon={<MailIcon />}
              title={`Sent personalized emails to ${results.peopleContacted} prospects`}
              detail={results.failedSends > 0 ? `${results.failedSends} sends failed and are recorded as failures` : "Each send happens only after your approval"}
            />
            <PlainEnglishRow
              icon={<ReplyIcon />}
              title={`${results.replies} people replied (${replyRate}% reply rate)`}
              detail="Replies appear here when prospects respond"
            />
            <PlainEnglishRow
              icon={<HeartIcon />}
              title={`${results.interested} showed genuine interest`}
              detail="Follow up with interested prospects from your inbox"
            />
            <PlainEnglishRow
              icon={<CalendarIcon />}
              title={`${results.followUpsPending} follow-ups pending`}
              detail="Scheduled follow-ups waiting for their due date"
            />
          </div>
        </Section>
      </Reveal>

      {/* Funnel Visualization */}
      <Reveal delay={0.15} className="mb-12">
        <Section className="py-0">
          <h2 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy mb-6">
            The funnel
          </h2>
          <FunnelVisualization
            steps={[
              { label: "Prospects", value: results.prospects, color: "bg-navy" },
              { label: "Contacted", value: results.peopleContacted, color: "bg-accent" },
              { label: "Replied", value: results.replies, color: "bg-accent" },
              { label: "Interested", value: results.interested, color: "bg-success" },
            ]}
          />
        </Section>
      </Reveal>

      {/* Technical Details (collapsible) */}
      <Reveal delay={0.2} className="mb-8">
        <Section className="py-0">
          <details className="rounded-lg border border-line bg-white">
            <summary className="px-6 py-4 cursor-pointer font-mono text-[10px] uppercase tracking-[0.14em] text-muted flex items-center justify-between">
              Technical details
              <span className="text-accent">▼</span>
            </summary>
            <div className="px-6 pb-6 border-t border-line grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <p className="text-muted">Reply rate</p>
                <p className="font-semibold text-navy">{replyRate}%</p>
              </div>
              <div>
                <p className="text-muted">Interest rate</p>
                <p className="font-semibold text-navy">{conversionRate}%</p>
              </div>
              <div>
                <p className="text-muted">Failed sends</p>
                <p className="font-semibold text-navy">{results.failedSends}</p>
              </div>
              <div>
                <p className="text-muted">Awaiting decision</p>
                <p className="font-semibold text-navy">{results.awaitingDecision}</p>
              </div>
            </div>
          </details>
        </Section>
      </Reveal>

      {/* Next Actions - Prominent */}
      <Reveal delay={0.25}>
        <div className="rounded-lg border border-line bg-white p-6">
          <h3 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy mb-4">
            What to do next
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Link href="/acquisition/replies">
              <div className="rounded-lg border border-line p-5 hover:border-accent transition-colors">
                <p className="font-medium text-navy">Reply to interested prospects</p>
                <p className="mt-1 text-sm text-muted">{results.interested} waiting for your response</p>
              </div>
            </Link>
            <Link href="/acquisition/outreach">
              <div className="rounded-lg border border-line p-5 hover:border-accent transition-colors">
                <p className="font-medium text-navy">Send follow-ups</p>
                <p className="mt-1 text-sm text-muted">Re-engage prospects who haven't replied</p>
              </div>
            </Link>
            <Link href="/acquisition/leads">
              <div className="rounded-lg border border-line p-5 hover:border-accent transition-colors">
                <p className="font-medium text-navy">Review new leads</p>
                <p className="mt-1 text-sm text-muted">Acquisition OS finds new prospects daily</p>
              </div>
            </Link>
            <Link href="/acquisition/billing">
              <div className="rounded-lg border border-line p-5 hover:border-accent transition-colors">
                <p className="font-medium text-navy">Extend your lease</p>
                <p className="mt-1 text-sm text-muted">Keep access to continue acquiring customers</p>
              </div>
            </Link>
          </div>
        </div>
      </Reveal>
    </Container>
  );
}

function BigNumberCard({ label, value, description, icon }: { label: string; value: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-white p-6">
      <div className="flex items-start justify-between">
        <div className="text-muted">{icon}</div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
      </div>
      <p className="mt-4 font-heading text-[40px] font-semibold tracking-[-0.02em] text-navy">{value}</p>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </div>
  );
}

function PlainEnglishRow({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) {
  return (
    <div className="flex gap-4 p-4 rounded-lg border border-line bg-white">
      <div className="flex-shrink-0 mt-0.5 text-accent">{icon}</div>
      <div>
        <p className="font-medium text-navy">{title}</p>
        <p className="mt-1 text-sm text-muted">{detail}</p>
      </div>
    </div>
  );
}

function FunnelVisualization({ steps }: { steps: Array<{ label: string; value: number; color: string }> }) {
  const maxValue = Math.max(0, ...steps.map(s => (Number.isFinite(s.value) ? s.value : 0)));

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const width = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
        return (
          <div key={step.label} className="relative">
            <div className="flex items-center gap-4">
              <div className="w-24 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                {step.label}
              </div>
              <div className="flex-1 h-8 bg-line rounded relative overflow-hidden">
                <div
                  className={`h-full rounded ${step.color} transition-all duration-500`}
                  style={{ width: `${width}%` }}
                />
                <span className="absolute inset-0 flex items-center pl-4 font-mono text-sm font-medium text-navy-dark">
                  {step.value.toLocaleString()}
                </span>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className="absolute left-[96px] top-8 bottom-[-12px] w-0.5 bg-line" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Icons
function UsersIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ReplyIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18h-1a4 4 0 0 0 0-8 4 4 0 0 1 0-8h1" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function DollarIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}