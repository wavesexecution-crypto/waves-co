"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import { Container } from "@/components/container";

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);

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
        <Button href="/architecture-audit" className="hidden md:inline-flex">
          Book Review
        </Button>
        <Button href="/architecture-audit" className="md:hidden">
          Book
        </Button>
      </Container>
    </header>
  );
}
