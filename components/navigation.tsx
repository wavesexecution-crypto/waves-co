"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/button";
import { Container } from "@/components/container";

// One product, so the nav names it. There is deliberately no separate
// "Products" entry alongside "Product" — that implied a catalogue.
const NAV_LINKS = [
  { href: "/products/acquisition-os", label: "Product" },
  { href: "/#lease", label: "Pricing" },
  { href: "/case-study", label: "Case Study" },
];

function UserAvatar({ name, email }: { name: string; email: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = () => setOpen(false);
    if (open) document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-sm font-medium text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-2"
        aria-label="Profile menu"
      >
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-line bg-white py-1 shadow-lg">
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-medium text-navy">{name}</p>
            <p className="text-xs text-muted truncate">{email}</p>
          </div>
          <Link href="https://app.wavesco.in" className="block px-4 py-2 text-sm text-body hover:bg-muted/50">
            Dashboard
          </Link>
          <Link href="https://app.wavesco.in/settings" className="block px-4 py-2 text-sm text-body hover:bg-muted/50">
            Account
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="block w-full px-4 py-2 text-left text-sm text-destructive hover:bg-muted/50"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Navigation() {
  const pathname = usePathname() ?? "";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  const user = session?.user;
  const isAuth = !!user;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile menu on outside click and on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // The product shell owns its own single header under /acquisition* — the
  // marketing nav must not render there (no duplicated navigation).
  if (pathname === "/acquisition" || pathname.startsWith("/acquisition/")) return null;

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        scrolled
          ? "border-line bg-paper/95 shadow-[0_8px_30px_rgba(6,20,46,0.06)] backdrop-blur-md"
          : "border-line/70 bg-paper/90 backdrop-blur-sm"
      }`}
    >
      <Container className="relative flex h-16 items-center justify-between gap-6">
        <Link
          href="/"
          className="focus-ring flex items-center gap-4 rounded-sm text-navy"
          aria-label="WAVES home"
        >
          <span className="font-heading text-2xl font-bold tracking-[0.12em] uppercase">WAVES</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-body md:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} className="transition-colors duration-200 hover:text-navy" href={l.href}>
              {l.label}
            </Link>
          ))}
        </nav>

        {/* One primary CTA. The same link previously appeared three times
            (nav link, ghost button, mobile button). */}
        <div className="hidden items-center gap-3 md:flex">
          {isAuth ? (
            <UserAvatar name={user.name || user.email || "WAVES"} email={user.email || ""} />
          ) : (
            <>
              <Button href="/login">Sign in</Button>
              <Button href="/signup?from=proof">Start 2-Day Proof</Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Button href="/signup?from=proof">
            {/* Full label wrapped onto two lines at 375px; shorten on the
                narrowest screens rather than letting the header grow. */}
            <span className="sm:hidden">Start Proof</span>
            <span className="hidden sm:inline">Start 2-Day Proof</span>
          </Button>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-sm border border-line bg-white text-navy"
          >
            {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>

        {/* Without this the nav links were unreachable below 768px. */}
        {menuOpen ? (
          <div
            id="mobile-nav"
            ref={navRef}
            className="absolute left-0 right-0 top-16 z-50 border-b border-line bg-white shadow-[0_12px_30px_rgba(6,20,46,0.10)] md:hidden"
          >
            <nav className="flex flex-col text-sm font-medium text-body">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="border-b border-line/60 px-6 py-4 transition-colors duration-200 last:border-b-0 hover:bg-muted/50 hover:text-navy"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        ) : null}
      </Container>
    </header>
  );
}