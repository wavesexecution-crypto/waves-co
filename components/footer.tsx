import Link from "next/link";
import { Button } from "@/components/button";
import { Container } from "@/components/container";

export function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <Container className="py-24 sm:py-32">
        <div className="grid gap-16 lg:grid-cols-[2fr_1fr_1.2fr]">
          {/* Brand Column */}
          <div className="flex flex-col gap-6">
            <div>
              <span className="font-heading text-2xl font-bold tracking-[0.12em] uppercase text-navy">
                WAVES
              </span>
            </div>
            <h2 className="font-heading text-[28px] font-semibold leading-tight text-navy sm:text-[32px] max-w-md">
              Your business. Made easier.
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-body">
              WAVES handles the work behind your business, from finding customers to running day-to-day operations.
            </p>
          </div>

          {/* Navigation Links Column */}
          <div className="flex flex-col gap-6">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Navigation
            </span>
            <nav className="flex flex-col gap-4 text-sm font-medium text-body">
              <Link className="transition-colors duration-200 hover:text-navy" href="/#audit-cycle">
                Product
              </Link>
              <Link className="transition-colors duration-200 hover:text-navy" href="/case-study">
                Case Study
              </Link>
              <Link className="transition-colors duration-200 hover:text-navy" href="/architecture-audit">
                Start with WAVES
              </Link>
            </nav>
          </div>

          {/* Action Column */}
          <div className="flex flex-col gap-6 items-start">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Get Started
            </span>
            <p className="text-sm leading-relaxed text-body">
              Book a confidential intake review to see how WAVES works for your business.
            </p>
            <Button href="/architecture-audit" className="w-full sm:w-auto">
              Start with WAVES
            </Button>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="mt-16 border-t border-line/60 pt-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            © 2024 WAVES. All rights reserved.
          </p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Confidential intake // Secure submission
          </p>
        </div>
      </Container>
    </footer>
  );
}