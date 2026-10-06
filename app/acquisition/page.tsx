import { auth } from "@/lib/auth";
import { getEntitlement, hasCommercialAccess } from "@/lib/billing";
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
  let nextAction = { label: "Start 2-Day Proof", href: "/acquisition/onboarding" };

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
        nextAction = { label: "Lease Acquisition OS", href: "/acquisition/billing" };
      } else if (entitlement?.status === "ACTIVE") {
        const expires = entitlement.expiresAt ? new Date(entitlement.expiresAt) : null;
        if (expires) {
          const diff = expires.getTime() - Date.now();
          daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
          accessLabel = `Active lease: ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`;
        }
        nextAction = { label: "Extend lease", href: "/acquisition/billing" };
      } else if (entitlement?.status === "TRIAL_EXPIRED") {
        accessLabel = "Trial expired";
        nextAction = { label: "Lease Acquisition OS", href: "/acquisition/billing" };
      } else if (entitlement?.status === "EXPIRED") {
        accessLabel = "Lease expired";
        nextAction = { label: "Extend lease", href: "/acquisition/billing" };
      } else {
        accessLabel = "No active lease";
        nextAction = { label: "Start 2-Day Proof", href: "/acquisition/onboarding" };
      }
    } catch {
      accessLabel = "Unable to load access";
    }
  }

  // Mock data for today's activity - replace with real data later
  const todayStats = {
    customersFound: 0,
    emailsSent: 0,
    replies: 0,
    interested: 0,
    meetings: 0,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <Reveal className="mb-8">
        <h1 className="font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
          Acquisition OS
        </h1>
        <p className="mt-2 text-sm text-body">Your command center for finding and winning customers.</p>
      </Reveal>

      {/* Access Status Card */}
      <Reveal delay={0.05} className="mb-8">
        <div className="rounded-lg border border-line bg-white p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Current Access</p>
              <p className="mt-1 font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy sm:text-[28px]">
                {accessLabel}
              </p>
            </div>
            <Button href={nextAction.href} className="w-full sm:w-auto">
              {nextAction.label}
            </Button>
          </div>
        </div>
      </Reveal>

      {/* Today's Activity */}
      <Section className="mb-8">
        <Reveal className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Today</p>
          <h2 className="mt-2 font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy sm:text-[28px]">
            Activity
          </h2>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Customers found" value={todayStats.customersFound} icon="users" />
          <StatCard label="Emails sent" value={todayStats.emailsSent} icon="mail" />
          <StatCard label="Replies" value={todayStats.replies} icon="reply" />
          <StatCard label="Interested" value={todayStats.interested} icon="heart" />
          <StatCard label="Meetings" value={todayStats.meetings} icon="calendar" />
        </div>
      </Section>

      {/* Next Step */}
      <Reveal delay={0.1} className="mb-8">
        <div className="rounded-lg border border-line bg-white p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Your next step</p>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy sm:text-[28px]">
                {tenantId && hasAccess ? "Review your leads" : "Tell us what you sell"}
              </h3>
              <p className="mt-1 text-sm text-body">
                {tenantId && hasAccess
                  ? "You have leads waiting for your approval."
                  : "Start by describing your business so we can find the right customers."}
              </p>
            </div>
            <Button
              href={tenantId && hasAccess ? "/acquisition/leads" : "/acquisition/onboarding"}
              className="w-full sm:w-auto"
            >
              {tenantId && hasAccess ? "Review leads" : "Get started"}
            </Button>
          </div>
        </div>
      </Reveal>

      {/* Quick Links */}
      <Reveal delay={0.15}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink
            href="/acquisition/leads"
            label="Leads"
            description="Review and approve customers"
            disabled={!tenantId || !hasAccess}
          />
          <QuickLink
            href="/acquisition/outreach"
            label="Outreach"
            description="Review and send emails"
            disabled={!tenantId || !hasAccess}
          />
          <QuickLink
            href="/acquisition/replies"
            label="Replies"
            description="See and respond to interest"
            disabled={!tenantId || !hasAccess}
          />
          <QuickLink
            href="/acquisition/results"
            label="Results"
            description="View your acquisition report"
            disabled={!tenantId || !hasAccess}
          />
        </div>
      </Reveal>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  const icons: Record<string, React.ReactNode> = {
    users: <UsersIcon />,
    mail: <MailIcon />,
    reply: <ReplyIcon />,
    heart: <HeartIcon />,
    calendar: <CalendarIcon />,
  };

  return (
    <div className="rounded-lg border border-line bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
        <div className="text-muted/40">{icons[icon]}</div>
      </div>
      <p className="mt-2 font-heading text-[32px] font-semibold tracking-[-0.02em] text-navy">{value}</p>
    </div>
  );
}

function QuickLink({ href, label, description, disabled }: { href: string; label: string; description: string; disabled?: boolean }) {
  return (
    <Link
      href={disabled ? "#" : href}
      className={`rounded-lg border p-5 transition-colors ${
        disabled
          ? "border-line bg-paper/50 opacity-50 pointer-events-none"
          : "border-line bg-white hover:border-accent hover:bg-white"
      }`}
    >
      <h3 className="font-heading text-[18px] font-semibold tracking-[-0.01em] text-navy">{label}</h3>
      <p className="mt-1 text-sm text-body">{description}</p>
    </Link>
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

function MailIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
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

function CalendarIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}