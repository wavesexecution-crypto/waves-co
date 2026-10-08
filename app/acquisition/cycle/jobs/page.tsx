"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { Reveal } from "@/components/reveal";

interface Job {
  id: string;
  operation?: string;
  event?: string;
  status: string;
  attempt?: number;
  attempts?: number;
  error?: string | null;
  lastError?: string | null;
  updatedAt: string;
}

export default function JobsPage() {
  const [aiJobs, setAiJobs] = useState<Job[]>([]);
  const [n8nJobs, setN8nJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/acquisition/jobs");
    if (!res.ok) throw new Error("Could not load jobs.");
    const j = await res.json();
    setAiJobs(j.aiJobs ?? []);
    setN8nJobs(j.n8nJobs ?? []);
  }

  useEffect(() => {
    refresh().catch(() => setError("Could not load jobs."));
  }, []);

  async function poll() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/acquisition/jobs/poll", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Poll failed.");
      setNotice(
        `Advanced ${j.ai.length} AI and ${j.n8n.length} automation jobs. Pending: ${j.states.pending}, failed visible: ${j.states.failed}.`,
      );
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Poll failed.");
    } finally {
      setBusy(false);
    }
  }

  async function retry(kind: "ai" | "n8n", jobId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/acquisition/jobs/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, jobId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Retry failed.");
      setNotice("Job queued for retry — poll to advance it.");
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Retry failed.");
    } finally {
      setBusy(false);
    }
  }

  function row(j: Job, kind: "ai" | "n8n") {
    return (
      <li key={j.id} className="flex items-center justify-between gap-3 rounded-md border border-line p-3 text-sm">
        <div>
          <p className="font-medium text-navy">
            {j.operation ?? j.event} · {j.status}
          </p>
          <p className="font-mono text-[10px] text-muted">
            attempts {j.attempt ?? j.attempts ?? 0}
            {(j.error ?? j.lastError) ? ` · ${(j.error ?? j.lastError ?? "").slice(0, 160)}` : ""}
          </p>
        </div>
        {j.status === "FAILED" || j.status === "RETRY_PENDING" ? (
          <Button variant="secondary" disabled={busy} onClick={() => retry(kind, j.id)}>
            Retry
          </Button>
        ) : null}
      </li>
    );
  }

  return (
    <Container className="py-8">
      <Reveal className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Observability</p>
        <h1 className="mt-2 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
          Jobs
        </h1>
        <p className="mt-2 text-sm text-body">
          Every AI and automation job for your workspace. Polling here also advances due work — there are no hidden
          background workers.
        </p>
      </Reveal>

      {error ? <p role="alert" className="mb-4 text-sm text-error">{error}</p> : null}
      {notice ? <p className="mb-4 text-sm text-success">{notice}</p> : null}

      <Button disabled={busy} onClick={poll}>
        {busy ? "Working…" : "Check for updates + advance due jobs"}
      </Button>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Reveal>
          <div className="rounded-lg border border-line bg-white p-6">
            <h2 className="font-heading text-[20px] font-semibold text-navy">AI jobs</h2>
            <ul className="mt-3 space-y-2">
              {aiJobs.map((j) => row(j, "ai"))}
              {aiJobs.length === 0 ? <p className="text-sm text-muted">No AI jobs yet.</p> : null}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <div className="rounded-lg border border-line bg-white p-6">
            <h2 className="font-heading text-[20px] font-semibold text-navy">Automation jobs</h2>
            <ul className="mt-3 space-y-2">
              {n8nJobs.map((j) => row(j, "n8n"))}
              {n8nJobs.length === 0 ? <p className="text-sm text-muted">No automation jobs yet.</p> : null}
            </ul>
          </div>
        </Reveal>
      </div>
    </Container>
  );
}
