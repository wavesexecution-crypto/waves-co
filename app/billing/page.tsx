import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await auth();
  const tenantId = (session as any)?.user?.tenantId as string | null;
  let ent: any = null;
  if (tenantId) {
    try {
      ent = await withTenantContext(tenantId, async (tx: any) => tx.acquisitionEntitlement.findUnique({ where: { tenantId } }));
    } catch {}
  }
  const status = ent?.status ?? "NONE";
  const lease = ent?.leaseType ?? "—";
  return (
    <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <h1 className="font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy">Billing — Acquisition OS</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-body">One Waves account. Lease duration is the only variable. Same Acquisition OS for every lease.</p>
      {!tenantId && <p className="mt-6 text-sm text-muted">Please <Link href="/login" className="underline">sign in</Link> to view your lease.</p>}
      {tenantId && (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="rounded-sm border border-line bg-white p-6">
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Current entitlement</div>
            <div className="mt-3 text-sm"><span className="text-muted">Status:</span> <span className="font-medium text-navy">{status}</span></div>
            <div className="text-sm"><span className="text-muted">Lease:</span> {lease}</div>
            {ent?.startedAt && <div className="text-sm"><span className="text-muted">Started:</span> {new Date(ent.startedAt).toLocaleDateString()}</div>}
            {ent?.expiresAt && <div className="text-sm"><span className="text-muted">Expires:</span> {new Date(ent.expiresAt).toLocaleDateString()}</div>}
            {ent?.pricePaise && <div className="text-sm"><span className="text-muted">Value:</span> ₹{(ent.pricePaise/100).toLocaleString("en-IN")}</div>}
            <div className="mt-6 flex gap-3">
              <Link href="/#lease" className="inline-flex h-10 items-center justify-center rounded-sm bg-navy px-5 text-sm font-medium text-white">Extend Lease</Link>
              <Link href="/api/billing/entitlement" className="inline-flex h-10 items-center justify-center rounded-sm border border-line bg-white px-5 text-sm font-medium text-navy">View JSON</Link>
            </div>
          </div>
          <div className="rounded-sm border border-line bg-paper p-6">
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Lease options</div>
            <ul className="mt-3 space-y-2 text-sm text-body">
              <li>30 Days — ₹60,000</li>
              <li>90 Days — ₹1,65,000 <span className="text-muted">(Save ₹15,000)</span></li>
              <li>180 Days — ₹3,00,000 <span className="text-muted">(Save ₹60,000)</span></li>
              <li>365 Days — ₹5,40,000 <span className="text-muted">(Save ₹2,40,000)</span></li>
            </ul>
            <p className="mt-4 text-xs text-muted">Prices locked server-side. Payment verified via Razorpay HMAC. No tiers.</p>
          </div>
        </div>
      )}
      <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Invoices require GSTIN/company details — Configure RAZORPAY_KEY_ID/SECRET and GSTIN in env.</p>
    </div>
  );
}
