"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/button";
import { Container } from "@/components/container";

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
  const [scrolled, setScrolled] = useState(false);
  const { data: session } = useSession();
  const user = session?.user;
  const isAuth = !!user;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        scrolled
          ? "border-line bg-paper/95 shadow-[0_8px_30px_rgba(6,20,46,0.06)] backdrop-blur-md"
          : "border-line/70 bg-paper/90 backdrop-blur-sm"
      }`}
    >
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link
          href="/"
          className="focus-ring flex items-center gap-4 rounded-sm text-navy"
          aria-label="Waves home"
        >
          <span className="font-heading text-2xl font-bold tracking-[0.12em] uppercase">Waves</span>
          <span className="hidden h-4 w-px bg-line/80 sm:block" />
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted sm:inline">
            Systems Architecture
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-body md:flex">
          <Link className="transition-colors duration-200 hover:text-navy" href="/#audit-cycle">
            Audit Cycle
          </Link>
          <Link className="transition-colors duration-200 hover:text-navy" href="#products">
            Products
          </Link>
          <Link className="transition-colors duration-200 hover:text-navy" href="/#process">
            Process
          </Link>
          <Link className="transition-colors duration-200 hover:text-navy" href="/case-study">
            Case Study
          </Link>
          <Link className="transition-colors duration-200 hover:text-navy" href="/architecture-audit">
            Architecture Audit
          </Link>
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <Button href="/architecture-audit" variant="ghost" className="hidden lg:inline-flex">
            Book Review
          </Button>
          {isAuth ? (
            <UserAvatar name={user.name || user.email || "Waves"} email={user.email || ""} />
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-body transition-colors hover:text-navy">
                Sign in
              </Link>
              <Button href="/login">Sign in →</Button>
            </>
          )}
        </div>
        <Button href="/architecture-audit" className="md:hidden">
          Book
        </Button>
      </Container>
    </header>
  );
}
