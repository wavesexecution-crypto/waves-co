import { auth } from "@/lib/auth";
import { getEntitlement, hasCommercialAccess, LEASE_PRICES } from "@/lib/billing";
import { formatINRPaise } from "@/lib/leases";
import Link from "next/link";
import { Button } from "@/components/button";
import { Container, Section } from "@/components/container";
import { Reveal } from "@/components/reveal";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await auth();
  const user = session?.user;
  const tenantId = user?.tenantId as string | undefined;

  let entitlement = null;
  let hasAccess = false;
  let accessStatus = "none";
  let accessLabel = "No active lease";
  let daysRemaining = 0;
  let expiresAt: Date | null = null;
  let currentLeaseType: string | null = null;

  if (tenantId) {
    try {
      entitlement = await getEntitlement(tenantId);
      hasAccess = hasCommercialAccess(entitlement);

      if (entitlement?.status === "TRIAL") {
        accessStatus = "trial";
        const trialEnd = entitlement.trialExpiresAt ? new Date(entitlement.trialExpiresAt) : null;
        if (trialEnd) {
          expiresAt = trialEnd;
          const diff = trialEnd.getTime() - Date.now();
          daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
          accessLabel = `Free trial: ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`;
        }
        currentLeaseType = "TRIAL_2D";
      } else if (entitlement?.status === "ACTIVE") {
        accessStatus = "active";
        const expires = entitlement.expiresAt ? new Date(entitlement.expiresAt) : null;
        if (expires) {
          expiresAt = expires;
          const diff = expires.getTime() - Date.now();
          daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
          accessLabel = `Active lease: ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`;
        }
        currentLeaseType = entitlement.leaseType;
      } else if (entitlement?.status === "TRIAL_EXPIRED") {
        accessStatus = "trial_expired";
        accessLabel = "Trial expired";
      } else if (entitlement?.status === "EXPIRED") {
        accessStatus = "expired";
        accessLabel = "Lease expired";
      } else if (entitlement?.status === "CANCELLED") {
        accessStatus = "cancelled";
        accessLabel = "Cancelled";
      } else if (entitlement?.status === "REFUNDED") {
        accessStatus = "refunded";
        accessLabel = "Refunded";
      } else {
        accessStatus = "none";
        accessLabel = "No active lease";
      }
    } catch {
      accessLabel = "Unable to load access";
    }
  }

  const LEASE_OPTIONS = [
    { days: 30, leaseType: "LEASE_30", pricePaise: 6000000, monthlyPaise: 6000000, savePaise: 0, label: "30 Days" },
    { days: 90, leaseType: "LEASE_90", pricePaise: 16500000, monthlyPaise: 5500000, savePaise: 1500000, label: "90 Days" },
    { days: 180, leaseType: "LEASE_180", pricePaise: 30000000, monthlyPaise: 5000000, savePaise: 6000000, label: "180 Days" },
    { days: 365, leaseType: "LEASE_365", pricePaise: 54000000, monthlyPaise: 4500000, savePaise: 24000000, label: "365 Days" },
  ];

  return (
    <Container className="py-8">
      {/* Header */}
      <Reveal className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Access</p>
            <h1 className="mt-2 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
              Your Acquisition OS access
            </h1>
            <p className="mt-2 text-sm text-body">
              One product. Lease duration is the only variable.
            </p>
          </div>
          {!tenantId && (
            <Link href="/login?callbackUrl=/acquisition/billing">
              <Button>Sign in to manage</Button>
            </Link>
          )}
        </div>
      </Reveal>

      {/* Current Access Card */}
      <Reveal delay={0.05} className="mb-12">
        <div className={`rounded-lg border p-6 ${
          accessStatus === "active" ? "border-success bg-success/5" :
          accessStatus === "trial" ? "border-accent bg-accent/5" :
          "border-line bg-white"
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                accessStatus === "active" ? "bg-success/10 text-success" :
                accessStatus === "trial" ? "bg-accent/10 text-accent" :
                "bg-muted/20 text-muted"
              }`}>
                {accessStatus === "active" && <CheckCircleIcon className="h-6 w-6" />}
                {accessStatus === "trial" && <ClockIcon className="h-6 w-6" />}
                {accessStatus === "trial_expired" && <AlertCircleIcon className="h-6 w-6" />}
                {accessStatus === "expired" && <AlertCircleIcon className="h-6 w-6" />}
                {accessStatus === "none" && <LockIcon className="h-6 w-6" />}
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Current status</p>
                <h2 className="mt-1 font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy">
                  {accessLabel}
                </h2>
                {currentLeaseType && currentLeaseType !== "TRIAL_2D" && (
                  <p className="mt-1 text-sm text-muted">{currentLeaseType.replace("_", " ")}</p>
                )}
              </div>
            </div>
            {tenantId && (
              <Button href="/acquisition/billing" className="w-full sm:w-auto" size="lg">
                {accessStatus === "active" || accessStatus === "trial" ? "Extend lease" : "Get access"}
              </Button>
            )}
          </div>

          {expiresAt && (
            <div className="mt-6 pt-6 border-t border-current/20">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                Expires {expiresAt.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          )}
        </div>
      </Reveal>

      {/* What You Get */}
      <Reveal delay={0.1} className="mb-12">
        <Section className="py-0">
          <h2 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy mb-6">
            What you get with every lease
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<SearchIcon />}
              title="Find customers"
              description="Market research, prospect discovery, and lead scoring"
            />
            <FeatureCard
              icon={<MailIcon />}
              title="Personalized outreach"
              description="Human-approved emails sent on your behalf"
            />
            <FeatureCard
              icon={<ReplyIcon />}
              title="Reply handling"
              description="Inbox for responses, follow-ups, and meeting scheduling"
            />
            <FeatureCard
              icon={<FileTextIcon />}
              title="Acquisition report"
              description="Plain-English results — no dashboards to interpret"
            />
          </div>
        </Section>
      </Reveal>

      {/* Lease Options */}
      <Reveal delay={0.15} className="mb-12">
        <Section className="py-0">
          <h2 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy mb-6">
            Choose your lease
          </h2>
          <p className="text-sm text-muted mb-6">
            Prices locked. No auto-renewal. No tiers. Payment verified via Razorpay.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
        { days: 30, leaseType: "LEASE_30", pricePaise: 6000000, monthlyPaise: 6000000, savePaise: 0, label: "30 Days" },
        { days: 90, leaseType: "LEASE_90", pricePaise: 16500000, monthlyPaise: 5500000, savePaise: 1500000, label: "90 Days" },
        { days: 180, leaseType: "LEASE_180", pricePaise: 30000000, monthlyPaise: 5000000, savePaise: 6000000, label: "180 Days" },
        { days: 365, leaseType: "LEASE_365", pricePaise: 54000000, monthlyPaise: 4500000, savePaise: 24000000, label: "365 Days" },
      ].map((option) => (
              <LeaseCard
                key={option.leaseType}
                option={option}
                current={currentLeaseType === option.leaseType}
                disabled={!tenantId}
              />
            ))}
          </div>
        </Section>
      </Reveal>

      {/* Simple Terms */}
      <Reveal delay={0.2}>
        <div className="rounded-lg border border-line bg-white p-6">
          <h3 className="font-heading text-[18px] font-semibold tracking-[-0.01em] text-navy mb-4">
            Simple terms
          </h3>
          <ul className="space-y-3 text-sm text-body">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
              <span>One complete product — no tiers, no feature gates</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
              <span>Lease duration is the only variable (30/90/180/365 days)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
              <span>No auto-renewal — you decide when to extend</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
              <span>2-day free proof — try before you lease</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
              <span>Payment via Razorpay — secure, verified, instant activation</span>
            </li>
          </ul>
        </div>
      </Reveal>
    </Container>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5">
      <div className="text-accent mb-3">{icon}</div>
      <h3 className="font-medium text-navy">{title}</h3>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </div>
  );
}

function LeaseCard({ option, current, disabled }: { option: { days: number; leaseType: string; pricePaise: number; monthlyPaise: number; savePaise: number; label: string }; current: boolean; disabled: boolean }) {
  const monthly = option.pricePaise / option.days * 30;

  return (
    <div className={`rounded-lg border p-6 transition-colors ${
      current
        ? "border-navy bg-navy/5"
        : disabled
        ? "border-line bg-paper/50 opacity-60 pointer-events-none"
        : "border-line bg-white hover:border-accent hover:bg-white"
    }`}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">{option.label}</span>
        {current && (
          <span className="px-2 py-0.5 rounded bg-navy/10 text-navy text-[10px] font-medium">Current</span>
        )}
      </div>
      <div className="mb-4">
        <p className="font-heading text-[28px] font-semibold tracking-[-0.02em] text-navy">
          {formatINRPaise(option.pricePaise)}
        </p>
        <p className="text-sm text-muted">≈ {formatINRPaise(Math.round(monthly))}/month</p>
      </div>
      {option.savePaise > 0 && (
        <p className="text-sm text-success mb-4">Save {formatINRPaise(option.savePaise)} vs monthly</p>
      )}
      <Button className="w-full" disabled={disabled} onClick={() => {
        if (!disabled) {
          window.location.href = `/login?callbackUrl=/acquisition/billing`;
        }
      }}>
        {current ? "Current lease" : `Lease for ${option.days} days`}
      </Button>
    </div>
  );
}

// Icons
function CheckCircleIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ClockIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function AlertCircleIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function LockIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function SearchIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function MailIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function ReplyIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18h-1a4 4 0 0 0 0-8 4 4 0 0 1 0-8h1" />
    </svg>
  );
}

function FileTextIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}