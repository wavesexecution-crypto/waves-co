import type { Metadata } from "next";
import Link from "next/link";
import { Sidebar, SidebarBody } from "@/components/ui/sidebar";
import { LayoutDashboard, UserCog, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Sign in — WavesCo",
  description: "Continue with your Waves profile. One Waves account. All your products.",
};

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-[0.12em] uppercase text-navy">
      <span>WAVES</span>
      <span className="h-4 w-px bg-line" />
      <span className="font-mono text-[10px] tracking-[0.2em] text-muted">Systems Architecture</span>
    </Link>
  );
}

export default function LoginPage() {
  const links = [
    {
      label: "Dashboard",
      href: "/",
      icon: <LayoutDashboard className="h-5 w-5 text-navy" />,
    },
    {
      label: "Products",
      href: "/#products",
      icon: <UserCog className="h-5 w-5 text-navy" />,
    },
    {
      label: "Architecture Audit",
      href: "/architecture-audit",
      icon: <Settings className="h-5 w-5 text-navy" />,
    },
    {
      label: "Sign in",
      href: "/login",
      icon: <LogOut className="h-5 w-5 text-navy" />,
    },
  ];

  return (
    <div className={cn("flex h-screen w-full bg-paper")}>
      <Sidebar>
        <SidebarBody className="justify-between gap-10 border-r border-line bg-white">
          <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
            <Logo />
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-body hover:bg-paper hover:text-navy"
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="border-t border-line pt-4 text-xs text-muted">
            <p className="font-medium text-navy">Waves Account</p>
            <p>One Waves account. All your products.</p>
          </div>
        </SidebarBody>
      </Sidebar>

      <div className="flex flex-1 items-center justify-center bg-paper p-6">
        <div className="w-full max-w-md rounded-lg border border-line bg-white p-8 shadow-precise">
          <h1 className="text-2xl font-semibold tracking-tight text-navy">Continue with your Waves profile</h1>
          <p className="mt-2 text-sm text-body">
            Your Waves account is used across Waves. No separate login is required for Acquisition OS.
          </p>
          <p className="mt-1 text-xs text-muted">One Waves account. All your products — including Acquisition OS when rented.</p>

          <form className="mt-6 space-y-4" action="#" method="post">
            <div>
              <label htmlFor="email" className="text-sm font-medium text-navy">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@company.com"
                className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-sm font-medium text-navy">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy"
              />
            </div>
            <button type="submit" className="w-full rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-light">
              Continue to Waves
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-muted">
            No account yet?{" "}
            <Link href="/architecture-audit" className="font-medium text-navy hover:underline">
              Book Architecture Review
            </Link>
          </p>
          <p className="mt-3 text-center text-xs text-muted">Login happens on the main Waves site. app.wavesco.in does not have an independent customer login.</p>
        </div>
      </div>
    </div>
  );
}
