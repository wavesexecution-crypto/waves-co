"use client";

import Link from "next/link";

export interface CycleStep {
  n: string;
  title: string;
  href: string;
  state: "done" | "current" | "todo" | "attention";
  detail?: string;
}

export function Stepper({ steps, cycleLabel }: { steps: CycleStep[]; cycleLabel: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">{cycleLabel}</p>
      <ol className="mt-4 space-y-1">
        {steps.map((s) => (
          <li key={s.n}>
            <Link
              href={s.href}
              className={`flex items-center gap-4 rounded-md px-3 py-2.5 transition-colors hover:bg-paper ${
                s.state === "current" ? "bg-paper" : ""
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] ${
                  s.state === "done"
                    ? "bg-navy text-white"
                    : s.state === "current"
                      ? "bg-accent text-white"
                      : s.state === "attention"
                        ? "bg-error/10 text-error"
                        : "bg-line text-muted"
                }`}
              >
                {s.state === "done" ? "✓" : s.n}
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium text-navy">{s.title}</span>
                {s.detail ? <span className="block text-xs text-muted">{s.detail}</span> : null}
              </span>
              {s.state === "attention" ? (
                <span className="rounded bg-error/10 px-2 py-0.5 text-[10px] font-medium text-error">needs you</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
