import Link from "next/link";
import { auth } from "@/lib/auth";
import { Providers } from "@/components/providers";
import { withTenantContext } from "@/lib/context";
import { CycleNav } from "./cycle-nav";

/**
 * Acquisition OS Control Center shell: exactly ONE header with two tiers.
 * Row 1 — the persistent command-center chrome: brand, module navigation
 * (Home/Setup/Leads/Outreach/Replies/Reports/Billing), account. Row 2 — the
 * current acquisition workflow: the six cycle steps + active cycle badge.
 * The global marketing nav hides itself inside /acquisition* (see
 * components/navigation.tsx), so no duplicated navigation can appear.
 */
export default async function AcquisitionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const user = session?.user;
  const tenantId = user?.tenantId as string | undefined;

  let cycleLabel: string | null = null;
  if (tenantId) {
    try {
      const active = await withTenantContext(tenantId, (tx: any) =>
        tx.acquisitionCycle.findFirst({ where: { tenantId, status: "ACTIVE" }, orderBy: { cycleNumber: "desc" } }),
      );
      if (active) cycleLabel = `Wave Cycle ${String(active.cycleNumber).padStart(2, "0")}`;
    } catch {
      cycleLabel = null;
    }
  }

  return (
    <Providers session={session}>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/acquisition" className="flex items-center gap-2 text-navy hover:opacity-80 transition-opacity">
                <span className="font-heading text-xl font-bold tracking-[0.12em] uppercase">WAVES</span>
                <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.14em] text-accent">ACQUISITION OS</span>
              </Link>
              <nav className="hidden md:flex items-center gap-1 bg-paper/50 rounded-lg p-1" aria-label="Acquisition OS navigation">
                <Link href="/acquisition" className="px-3 py-1.5 text-sm font-medium text-body rounded-md hover:bg-white hover:text-navy transition-colors">Home</Link>
                <Link href="/acquisition/onboarding" className="px-3 py-1.5 text-sm font-medium text-body rounded-md hover:bg-white hover:text-navy transition-colors">Setup</Link>
                <Link href="/acquisition/leads" className="px-3 py-1.5 text-sm font-medium text-body rounded-md hover:bg-white hover:text-navy transition-colors">Leads</Link>
                <Link href="/acquisition/outreach" className="px-3 py-1.5 text-sm font-medium text-body rounded-md hover:bg-white hover:text-navy transition-colors">Outreach</Link>
                <Link href="/acquisition/replies" className="px-3 py-1.5 text-sm font-medium text-body rounded-md hover:bg-white hover:text-navy transition-colors">Replies</Link>
                <Link href="/acquisition/results" className="px-3 py-1.5 text-sm font-medium text-body rounded-md hover:bg-white hover:text-navy transition-colors">Reports</Link>
                <Link href="/acquisition/billing" className="px-3 py-1.5 text-sm font-medium text-body rounded-md hover:bg-white hover:text-navy transition-colors">Billing</Link>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted">{user.name || user.email}</span>
                  <Link href="/acquisition/settings" className="px-3 py-1.5 text-sm font-medium text-body rounded-md border border-line hover:bg-paper transition-colors">
                    Settings
                  </Link>
                </div>
              ) : (
                <Link href="/login?callbackUrl=/acquisition" className="px-4 py-1.5 text-sm font-medium text-white bg-navy rounded-md hover:bg-navy-light transition-colors">
                  Sign in
                </Link>
              )}
            </div>
          </div>
          <div className="flex h-10 items-center gap-2 border-t border-line/70">
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-muted sm:inline">Workflow</span>
            <div className="min-w-0 flex-1 overflow-hidden">
              <CycleNav cycleLabel={cycleLabel} />
            </div>
          </div>
        </div>
      </header>
      <main className="min-h-[calc(100vh-4rem)] bg-paper">
        {children}
      </main>
    </Providers>
  );
}
