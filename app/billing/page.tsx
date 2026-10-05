import { auth } from "@/lib/auth";
import { getEntitlement, hasCommercialAccess } from "@/lib/billing";
import { LEASES, formatINRPaise } from "@/lib/leases";
import { CheckoutButton } from "@/components/checkout-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

const inr = formatINRPaise;

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ lease?: string }> }) {
  const sp = await searchParams;
  const requestedDays = parseInt(sp?.lease ?? "", 10);
  const leaseRequested = LEASES.some((l) => l.days === requestedDays);

  const session = await auth();
  const tenantId = (session as any)?.user?.tenantId as string | null;
  // Expiry-aware: getEntitlement lazily flips TRIAL->TRIAL_EXPIRED and
  // ACTIVE->EXPIRED so the page can never show a stale active lease.
  let ent: any = null;
  if (tenantId) {
    try {
      ent = await getEntitlement(tenantId);
    } catch {}
  }
  const hasAccess = hasCommercialAccess(ent);
  const status = ent?.status ?? "NONE";
  const lease = ent?.leaseType ?? "—";
  return (
    <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <h1 className="font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy">Billing — WAVES ONE</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-body">One WAVES account. Lease duration is the only variable. Same system for every lease.</p>
      {!tenantId && <p className="mt-6 text-sm text-muted">Please <Link href="/login" className="underline">sign in</Link> to view your lease.</p>}
      {tenantId && (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-sm border border-line bg-white p-6">
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Current entitlement</div>
            <div className="mt-3 text-sm"><span className="text-muted">Status:</span> <span className="font-medium text-navy">{status}</span></div>
            <div className="text-sm"><span className="text-muted">Lease:</span> {lease}</div>
            <div className="text-sm"><span className="text-muted">Access:</span> {hasAccess ? "Active" : "Expired / none — extend to restore"}</div>
            {ent?.trialExpiresAt && ent?.status?.startsWith("TRIAL") && <div className="text-sm"><span className="text-muted">Trial expires:</span> {new Date(ent.trialExpiresAt).toLocaleDateString()}</div>}
            {ent?.startedAt && <div className="text-sm"><span className="text-muted">Started:</span> {new Date(ent.startedAt).toLocaleDateString()}</div>}
            {ent?.expiresAt && <div className="text-sm"><span className="text-muted">Expires:</span> {new Date(ent.expiresAt).toLocaleDateString()}</div>}
            {ent?.pricePaise ? <div className="text-sm"><span className="text-muted">Value:</span> {inr(ent.pricePaise)}</div> : null}
            <div className="mt-6 flex gap-3">
              <Link href="/#lease" className="inline-flex h-10 items-center justify-center rounded-sm bg-navy px-5 text-sm font-medium text-white">Extend Lease</Link>
              <Link href="/api/billing/entitlement" className="inline-flex h-10 items-center justify-center rounded-sm border border-line bg-white px-5 text-sm font-medium text-navy">View JSON</Link>
            </div>
          </div>
          <div className="rounded-sm border border-line bg-paper p-6">
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Lease options</div>
            <ul className="mt-3 space-y-2 text-sm text-body">
              {LEASES.map((l) => (
                <li key={l.days}>
                  {l.label} — {inr(l.pricePaise)}{" "}
                  {l.savePaise > 0 && <span className="text-muted">(Save {inr(l.savePaise)})</span>}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted">Prices locked server-side. Payment verified via Razorpay HMAC. No tiers. No auto-renewal.</p>
          </div>
        </div>
      )}

      {leaseRequested && !tenantId && (
        <p className="mt-8 text-sm text-muted">Please <Link href="/login" className="underline">sign in</Link> to lease WAVES ONE for {requestedDays} days.</p>
      )}

      {tenantId && (
        <div className="mt-10">
          <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Lease or extend</div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {LEASES.map((l) => (
              <div key={l.days} className={`rounded-sm border p-6 ${l.days === requestedDays ? "border-navy/40 bg-paper" : "border-line bg-white"}`}>
                <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">{l.label}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-heading text-[24px] font-semibold tracking-[-0.015em] text-navy">{inr(l.pricePaise)}</span>
                  <span className="text-xs text-muted">/ {l.days} days</span>
                </div>
                {l.savePaise > 0 && <div className="mt-2 text-xs text-emerald-700">Save {inr(l.savePaise)}</div>}
                <div className="mt-4">
                  <CheckoutButton days={l.days} amountPaise={l.pricePaise} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Invoices require GSTIN/company details unless already configured.</p>
    </div>
  );
}