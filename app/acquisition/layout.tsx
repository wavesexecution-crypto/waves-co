import Link from "next/link";
import { auth } from "@/lib/auth";
import { Providers } from "@/components/providers";
import { withTenantContext } from "@/lib/context";
import { CycleNav } from "./cycle-nav";

/**
 * Acquisition OS shell: exactly ONE header. Brand + the six cycle steps +
 * workspace overflow + account. No global marketing nav and no second module
 * nav inside the product (that duplication is gone on purpose).
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
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
          <Link href="/acquisition" className="flex shrink-0 items-center gap-2 hover:opacity-80 transition-opacity" aria-label="Acquisition OS home">
            <span className="font-heading text-base font-bold tracking-[0.12em] uppercase">Waves</span>
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-accent sm:inline">
              Acquisition OS
            </span>
          </Link>
          <div className="min-w-0 flex-1 overflow-hidden">
            <CycleNav cycleLabel={cycleLabel} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {user ? (
              <>
                <span className="hidden max-w-32 truncate text-[13px] text-muted md:inline">{user.name || user.email}</span>
                <Link
                  href="/acquisition/settings"
                  className="rounded-md border border-line px-2.5 py-1.5 text-[13px] font-medium text-body hover:bg-white transition-colors"
                >
                  Settings
                </Link>
              </>
            ) : (
              <Link
                href="/login?callbackUrl=/acquisition"
                className="rounded-md bg-navy px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-navy-light transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="min-h-[calc(100vh-3rem)] bg-paper">{children}</main>
    </Providers>
  );
}
