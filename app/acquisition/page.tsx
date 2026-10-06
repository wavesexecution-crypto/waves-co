import { auth } from "@/lib/auth";
import { getEntitlement, hasCommercialAccess } from "@/lib/billing";
import { fetchTenantStats } from "@/lib/acquisition";
import { formatINRPaise } from "@/lib/leases";
import Link from "next/link";
import { Button } from "@/components/button";
import { Container, Section } from "@/components/container";
import { Reveal } from "@/components/reveal";

export const dynamic = "force-dynamic";

export default async function AcquisitionHome() {
  const session = await auth();
  const user = session?.user;
  const tenantId = user?.tenantId as string | undefined;

  let entitlement = null;
  let hasAccess = false;
  let daysRemaining = 0;
  let accessLabel = "No active lease";
  let nextAction = { label: "Start 2-Day Proof", href: "/acquisition/onboarding", primary: true };

  if (tenantId) {
    try {
      entitlement = await getEntitlement(tenantId);
      hasAccess = hasCommercialAccess(entitlement);
      
      if (entitlement?.status === "TRIAL") {
        const trialEnd = entitlement.trialExpiresAt ? new Date(entitlement.trialExpiresAt) : null;
        if (trialEnd) {
          const diff = trialEnd.getTime() - Date.now();
          daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
          accessLabel = `Trial: ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`;
        }
        nextAction = { label: "Lease Acquisition OS", href: "/acquisition/billing", primary: true };
      } else if (entitlement?.status === "ACTIVE") {
        const expires = entitlement.expiresAt ? new Date(entitlement.expiresAt) : null;
        if (expires) {
          const diff = expires.getTime() - Date.now();
          daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
          accessLabel = `Active lease: ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`;
        }
        nextAction = { label: "Extend lease", href: "/acquisition/billing", primary: false };
      } else if (entitlement?.status === "TRIAL_EXPIRED") {
        accessLabel = "Trial expired";
        nextAction = { label: "Lease Acquisition OS", href: "/acquisition/billing", primary: true };
      } else if (entitlement?.status === "EXPIRED") {
        accessLabel = "Lease expired";
        nextAction = { label: "Extend lease", href: "/acquisition/billing", primary: true };
      } else {
        accessLabel = "No active lease";
        nextAction = { label: "Start 2-Day Proof", href: "/acquisition/onboarding", primary: true };
      }
    } catch {
      accessLabel = "Unable to load access";
    }
  }

  // Real counts from stored rows (zeros are honest for new workspaces).
  let todayStats = {
    customersFound: 0,
    emailsSent: 0,
    replies: 0,
    interested: 0,
    meetings: 0,
  };
  if (tenantId) {
    try {
      const s = await fetchTenantStats(tenantId);
      todayStats = {
        customersFound: s.leadsTotal,
        emailsSent: s.emailsSent,
        replies: s.replies,
        interested: s.interested,
        meetings: s.followUpsPending,
      };
    } catch {
      // Keep honest zeros on load failure.
    }
  }

  // Determine the primary next step based on state
  const primaryAction = (() => {
    if (!tenantId) return { label: "Start 2-Day Proof", href: "/acquisition/onboarding", description: "Set up your business and start finding customers" };
    if (!hasAccess) return { label: "Start 2-Day Proof", href: "/acquisition/onboarding", description: "Activate your free trial to unlock the system" };
    
    // Has access - check what needs attention
    if (todayStats.customersFound > 0 && todayStats.emailsSent === 0) {
      return { label: "Review leads", href: "/acquisition/leads", description: `${todayStats.customersFound} customers waiting for your decision` };
    }
    if (todayStats.emailsSent > 0 && todayStats.replies === 0) {
      return { label: "Check replies", href: "/acquisition/replies", description: `${todayStats.emailsSent} emails sent, waiting for responses` };
    }
    if (todayStats.replies > 0 && todayStats.interested === 0) {
      return { label: "View replies", href: "/acquisition/replies", description: `${todayStats.replies} replies received` };
    }
    if (todayStats.interested > 0) {
      return { label: "Follow up interested", href: "/acquisition/replies", description: `${todayStats.interested} prospects showed interest` };
    }
    
    return { label: "Review leads", href: "/acquisition/leads", description: "Check for new prospects" };
  })();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <Reveal className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
              Acquisition OS
            </h1>
            <p className="mt-2 text-sm text-body">Your command center for finding and winning customers.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.14em] text-accent bg-accent/10 px-2 py-0.5 rounded">
              {accessLabel}
            </span>
          </div>
        </div>
      </Reveal>

      {/* Primary Next Action - The One Thing */}
      <Reveal delay={0.05} className="mb-10">
        <div className="rounded-lg border border-line bg-white p-6 sm:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent mb-4">Your next step</p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <h2 className="font-heading text-[28px] font-semibold tracking-[-0.01em] text-navy sm:text-[36px]">
                {primaryAction.label}
              </h2>
              <p className="mt-2 text-base text-body">{primaryAction.description}</p>
            </div>
            <Button href={primaryAction.href} size="lg" className="w-full sm:w-auto shrink-0">
              {primaryAction.label}
            </Button>
          </div>
        </div>
      </Reveal>

      {/* Access Status (compact) */}
      {tenantId && (
        <Reveal delay={0.1} className="mb-8">
          <div className={`rounded-lg border p-4 ${
            entitlement?.status === "ACTIVE" ? "border-success bg-success/5" :
            entitlement?.status === "TRIAL" ? "border-accent bg-accent/5" :
            "border-line bg-white"
          }`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  entitlement?.status === "ACTIVE" ? "bg-success/10 text-success" :
                  entitlement?.status === "TRIAL" ? "bg-accent/10 text-accent" :
                  "bg-muted/20 text-muted"
                }`}>
                  {entitlement?.status === "ACTIVE" && <CheckCircleIcon className="h-5 w-5" />}
                  {entitlement?.status === "TRIAL" && <ClockIcon className="h-5 w-5" />}
                  {entitlement?.status === "TRIAL_EXPIRED" && <AlertCircleIcon className="h-5 w-5" />}
                  {entitlement?.status === "EXPIRED" && <AlertCircleIcon className="h-5 w-5" />}
                  {entitlement?.status === "none" && <LockIcon className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Access</p>
                  <p className="font-medium text-navy">{accessLabel}</p>
                </div>
              </div>
              {hasAccess ? (
                <Link href="/acquisition/billing">
                  <Button variant="secondary" size="sm">Manage lease</Button>
                </Link>
              ) : (
                <Link href="/acquisition/billing">
                  <Button size="sm">Get access</Button>
                </Link>
              )}
            </div>
          </div>
        </Reveal>
      )}

      {/* Today's Activity - Only if has access and data */}
      {tenantId && hasAccess && (todayStats.customersFound > 0 || todayStats.emailsSent > 0 || todayStats.replies > 0) && (
        <Reveal delay={0.15} className="mb-8">
          <Section className="py-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Today</p>
                <h2 className="mt-1 font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy sm:text-[28px]">
                  Activity
                </h2>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard label="Customers found" value={todayStats.customersFound} icon={<UsersIcon />} />
              <StatCard label="Emails sent" value={todayStats.emailsSent} icon={<MailIcon />} />
              <StatCard label="Replies" value={todayStats.replies} icon={<ReplyIcon />} />
              <StatCard label="Interested" value={todayStats.interested} icon={<HeartIcon />} />
              <StatCard label="Follow-ups" value={todayStats.meetings} icon={<CalendarIcon />} />
            </div>
          </Section>
        </Reveal>
      )}

      {/* Quick Access - Secondary actions */}
      <Reveal delay={0.2}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink
            href="/acquisition/leads"
            label="Leads"
            description="Review and approve customers"
            disabled={!tenantId || !hasAccess}
            icon={<UsersIcon />}
          />
          <QuickLink
            href="/acquisition/outreach"
            label="Outreach"
            description="Review and send emails"
            disabled={!tenantId || !hasAccess}
            icon={<MailIcon />}
          />
          <QuickLink
            href="/acquisition/replies"
            label="Replies"
            description="See and respond to interest"
            disabled={!tenantId || !hasAccess}
            icon={<ReplyIcon />} />
          <QuickLink
            href="/acquisition/results"
            label="Reports"
            description="View your acquisition report"
            disabled={!tenantId || !hasAccess}
            icon={<FileTextIcon />} />
        </div>
      </Reveal>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
        <div className="text-muted/40">{icon}</div>
      </div>
      <p className="mt-2 font-heading text-[28px] font-semibold tracking-[-0.02em] text-navy">{value}</p>
    </div>
  );
}

function QuickLink({ href, label, description, disabled, icon, className }: { href: string; label: string; description: string; disabled?: boolean; icon: React.ReactNode; className?: string }) {
  return (
    <Link
      href={disabled ? "#" : href}
      className={`rounded-lg border p-5 transition-colors flex flex-col gap-3 ${
        disabled
          ? "border-line bg-paper/50 opacity-50 pointer-events-none"
          : "border-line bg-white hover:border-accent hover:bg-white"
      } ${className ?? ""}`}
    >
      <div className="flex items-center gap-3">
        <div className="text-muted">{icon}</div>
        <h3 className="font-heading text-[18px] font-semibold tracking-[-0.01em] text-navy">{label}</h3>
      </div>
      <p className="text-sm text-body">{description}</p>
    </Link>
  );
}

// Icons
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
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

function ReplyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18h-1a4 4 0 0 0 0-8 4 4 0 0 1 0-8h1" />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function AlertCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}