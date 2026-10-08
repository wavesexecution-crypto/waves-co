"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const STEPS = [
  { n: "01", label: "Brain", href: "/acquisition/cycle/brain", match: ["/acquisition/cycle/brain"] },
  { n: "02", label: "Goal", href: "/acquisition/cycle/goal", match: ["/acquisition/cycle/goal"] },
  { n: "03", label: "Email", href: "/acquisition/cycle/email", match: ["/acquisition/cycle/email"] },
  { n: "04", label: "Mail", href: "/acquisition/cycle/send", match: ["/acquisition/cycle/send", "/acquisition/outreach"] },
  { n: "05", label: "Responses", href: "/acquisition/cycle/responses", match: ["/acquisition/cycle/responses", "/acquisition/replies"] },
  { n: "06", label: "Report", href: "/acquisition/cycle/report", match: ["/acquisition/cycle/report", "/acquisition/results"] },
] as const;

export function CycleNav({ cycleLabel }: { cycleLabel: string | null }) {
  const pathname = usePathname() ?? "";
  return (
    <div className="flex min-w-0 items-center gap-1">
      <nav className="flex items-center gap-0.5 overflow-x-auto" aria-label="Acquisition cycle steps">
        {STEPS.map((s) => {
          const active = s.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
          return (
            <Link
              key={s.n}
              href={s.href}
              aria-current={active ? "step" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                active ? "bg-white font-medium text-navy" : "text-body hover:bg-white hover:text-navy"
              }`}
            >
              <span className={`font-mono text-[10px] ${active ? "text-accent" : "text-muted"}`}>{s.n}</span>
              {s.label}
            </Link>
          );
        })}
      </nav>
      {cycleLabel ? (
        <span className="ml-1 hidden shrink-0 rounded border border-line bg-white px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted lg:inline-block">
          {cycleLabel}
        </span>
      ) : null}
    </div>
  );
}
