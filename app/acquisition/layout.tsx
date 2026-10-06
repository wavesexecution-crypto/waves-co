import Link from "next/link";
import { auth } from "@/lib/auth";
import { Navigation } from "@/components/navigation";
import { Providers } from "@/components/providers";
import { siteConfig } from "@/app/site";
import { Button } from "@/components/button";

export default async function AcquisitionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const user = session?.user;

  return (
    <Providers session={session}>
      <Navigation />
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
                <Link href="/acquisition/leads" className="px-3 py-1.5 text-sm font-medium text-body rounded-md hover:bg-white hover:text-navy transition-colors">Leads</Link>
                <Link href="/acquisition/outreach" className="px-3 py-1.5 text-sm font-medium text-body rounded-md hover:bg-white hover:text-navy transition-colors">Outreach</Link>
                <Link href="/acquisition/replies" className="px-3 py-1.5 text-sm font-medium text-body rounded-md hover:bg-white hover:text-navy transition-colors">Replies</Link>
                <Link href="/acquisition/results" className="px-3 py-1.5 text-sm font-medium text-body rounded-md hover:bg-white hover:text-navy transition-colors">Results</Link>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/acquisition/billing" className="hidden sm:block px-3 py-1.5 text-sm font-medium text-body rounded-md border border-line hover:bg-paper transition-colors">
                Access
              </Link>
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
        </div>
      </header>
      <main className="min-h-[calc(100vh-4rem)] bg-paper">
        {children}
      </main>
    </Providers>
  );
}