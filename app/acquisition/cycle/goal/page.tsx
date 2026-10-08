"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { Reveal } from "@/components/reveal";

interface Goal {
  id: string;
  title: string;
  audience?: string | null;
  geography?: string | null;
  outcome?: string | null;
  source: string;
  cycle: { cycleNumber: number; status: string };
}

export default function GoalPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("");
  const [geography, setGeography] = useState("");
  const [outcome, setOutcome] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/acquisition/goals");
    if (res.ok) setGoals((await res.json()).goals ?? []);
  }

  useEffect(() => {
    refresh().catch(() => setError("Could not load goals."));
  }, []);

  async function start(mode: "new" | "clone", extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/acquisition/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, ...extra }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Could not start cycle.");
      router.push("/acquisition/cycle/email");
    } catch (e: any) {
      setError(e?.message ?? "Could not start cycle.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container className="py-8">
      <Reveal className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Step 02 · Goal</p>
        <h1 className="mt-2 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
          What should this cycle target?
        </h1>
        <p className="mt-2 text-sm text-body">
          Every cycle gets its own goal. Reuse a previous one (safely cloned — history never changes) or define a new
          one.
        </p>
      </Reveal>

      {error ? <p role="alert" className="mb-4 text-sm text-error">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal>
          <div className="rounded-lg border border-line bg-white p-6">
            <h2 className="font-heading text-[20px] font-semibold text-navy">Create new goal</h2>
            <label className="mt-4 block text-sm font-medium text-navy">
              Goal title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Book 20 demos with Texas plumbers"
                className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy"
              />
            </label>
            <label className="mt-3 block text-sm font-medium text-navy">
              Target audience
              <input
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Owners and ops managers"
                className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy"
              />
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium text-navy">
                Geography
                <input
                  value={geography}
                  onChange={(e) => setGeography(e.target.value)}
                  placeholder="Texas, USA"
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy"
                />
              </label>
              <label className="block text-sm font-medium text-navy">
                Desired outcome
                <input
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  placeholder="Booked calls"
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy"
                />
              </label>
            </div>
            <Button
              className="mt-5"
              disabled={busy || title.trim().length < 4}
              onClick={() => start("new", { goal: { title: title.trim(), audience: audience.trim() || undefined, geography: geography.trim() || undefined, outcome: outcome.trim() || undefined } })}
            >
              {busy ? "Starting…" : "Start cycle with this goal"}
            </Button>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="rounded-lg border border-line bg-white p-6">
            <h2 className="font-heading text-[20px] font-semibold text-navy">Use previous goal</h2>
            {goals.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No previous goals yet — create your first one.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {goals.slice(0, 8).map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 rounded-md border border-line p-3">
                    <div>
                      <p className="text-sm font-medium text-navy">{g.title}</p>
                      <p className="font-mono text-[10px] text-muted">
                        Wave Cycle {String(g.cycle.cycleNumber).padStart(2, "0")} · {g.cycle.status.toLowerCase()}
                      </p>
                    </div>
                    <Button variant="secondary" disabled={busy} onClick={() => start("clone", { fromGoalId: g.id })}>
                      Reuse
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>
      </div>
    </Container>
  );
}
