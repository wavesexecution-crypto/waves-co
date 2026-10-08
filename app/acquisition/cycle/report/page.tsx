"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { Reveal } from "@/components/reveal";

interface ReportData {
  cycle: any;
  report: any | null;
  narrativeJob: any | null;
}

export default function CycleReportPage() {
  const router = useRouter();
  const [cycles, setCycles] = useState<Array<{ id: string; cycleNumber: number; status: string }>>([]);
  const [cycleId, setCycleId] = useState("");
  const [data, setData] = useState<ReportData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadCycles() {
    const res = await fetch("/api/acquisition/cycles");
    if (!res.ok) throw new Error("Could not load cycles.");
    const list = (((await res.json()).cycles ?? []) as Array<{ id: string; cycleNumber: number; status: string }>);
    setCycles(list);
    const first = list.find((c) => c.status === "CLOSED") ?? list[0];
    if (!cycleId && first) setCycleId(first.id);
    return list;
  }

  async function loadReport(id: string) {
    if (!id) return;
    const res = await fetch(`/api/acquisition/cycles/${id}/report`);
    if (res.status === 404) {
      setData(null);
      return;
    }
    if (!res.ok) throw new Error("Could not load report.");
    setData(await res.json());
  }

  useEffect(() => {
    loadCycles()
      .then((list) => {
        const first = list.find((c) => c.status === "CLOSED") ?? list[0];
        if (first) loadReport(first.id).catch(() => undefined);
      })
      .catch(() => setError("Could not load. Close a cycle to generate its first report."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadReport(cycleId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId]);

  async function closeCycle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/acquisition/cycles/${cycleId}/close`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Close failed.");
      setNotice("Cycle closed. Metrics are final; WAVE AI analysis follows when its job completes.");
      await loadReport(cycleId);
      await loadCycles();
    } catch (e: any) {
      setError(e?.message ?? "Close failed.");
    } finally {
      setBusy(false);
    }
  }

  async function nextCycle(mode: "clone" | "new", fromGoalId?: string) {
    if (mode === "new") {
      router.push("/acquisition/cycle/goal");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/acquisition/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "clone", fromGoalId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Could not start next cycle.");
      router.push("/acquisition/cycle/email");
    } catch (e: any) {
      setError(e?.message ?? "Could not start next cycle.");
    } finally {
      setBusy(false);
    }
  }

  const m = data?.report?.metrics;
  const n = data?.report?.narrative;
  const goalId = data?.cycle?.goals?.[0]?.id;

  return (
    <Container className="py-8">
      <Reveal className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Step 06 · Cycle Report</p>
        <h1 className="mt-2 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
          {data?.cycle ? `Wave Cycle ${String(data.cycle.cycleNumber).padStart(2, "0")}` : "Cycle Report"}
        </h1>
        <p className="mt-2 text-sm text-body">
          Metrics are computed deterministically from stored rows. The narrative interprets them — every percent or
          multiplier it cites already exists in the metrics.
        </p>
      </Reveal>

      {error ? <p role="alert" className="mb-4 text-sm text-error">{error}</p> : null}
      {notice ? <p className="mb-4 text-sm text-success">{notice}</p> : null}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-navy">
          Cycle{" "}
          <select
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
            className="ml-2 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                Wave Cycle {String(c.cycleNumber).padStart(2, "0")} · {c.status.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        {data?.cycle?.status === "ACTIVE" ? (
          <Button disabled={busy} onClick={closeCycle}>
            {busy ? "Closing…" : "Close cycle + generate report"}
          </Button>
        ) : null}
      </div>

      {!data?.report ? (
        <div className="rounded-lg border border-line bg-white p-8 text-center">
          <p className="text-sm text-body">
            {data?.cycle?.status === "ACTIVE"
              ? "This cycle is still running. Close it to compute the report — history is never rewritten afterwards."
              : "No report for this cycle yet."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Prospects contacted", m.prospectsContacted],
              ["Emails accepted", m.emailsAccepted],
              ["Replies", m.replies],
              ["Positive replies", m.positiveReplies],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg border border-line bg-white p-5">
                <p className="font-heading text-[28px] font-semibold text-navy">{String(value)}</p>
                <p className="mt-1 text-xs text-muted">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted">
            reply rate {m.replyRate} · positive rate {m.positiveRate} · delivered{" "}
            {m.deliveredKnown ? m.delivered : "unknown (no provider evidence)"}
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Reveal>
              <div className="rounded-lg border border-line bg-white p-6">
                <h2 className="font-heading text-[20px] font-semibold text-navy">Target performance</h2>
                {m.targets?.length ? (
                  <ul className="mt-3 space-y-2 text-sm">
                    {m.targets.map((t: any) => (
                      <li key={t.category} className="flex justify-between gap-2 border-b border-line pb-2 last:border-0">
                        <span className="font-medium text-navy">{t.category}</span>
                        <span className="font-mono text-[11px] text-muted">
                          sent {t.sent} · replies {t.replies} · rate {t.replyRate}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted">No sends in this cycle.</p>
                )}
                <h2 className="mt-6 font-heading text-[20px] font-semibold text-navy">Message performance</h2>
                {m.variants?.length ? (
                  <ul className="mt-3 space-y-2 text-sm">
                    {m.variants.map((v: any, i: number) => (
                      <li key={i} className="flex justify-between gap-2 border-b border-line pb-2 last:border-0">
                        <span className="font-medium text-navy">
                          {v.templateVersion ? `template v${v.templateVersion}` : "no template"} · {v.messageVariant}
                        </span>
                        <span className="font-mono text-[11px] text-muted">
                          sent {v.sent} · replies {v.replies} · rate {v.replyRate}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted">No sends in this cycle.</p>
                )}
              </div>
            </Reveal>

            <Reveal delay={0.05}>
              <div className="rounded-lg border border-line bg-white p-6">
                <h2 className="font-heading text-[20px] font-semibold text-navy">What WAVES learned</h2>
                {n ? (
                  <>
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-body">
                      {(n.learnings ?? []).map((l: string, i: number) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                    <h3 className="mt-4 text-sm font-medium text-navy">Next cycle recommendation</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-body">
                      {(n.recommendations ?? []).map((l: string, i: number) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                    {n.targetComparison ? <p className="mt-3 text-sm text-body">{n.targetComparison}</p> : null}
                    {n.messageComparison ? <p className="mt-2 text-sm text-body">{n.messageComparison}</p> : null}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted">
                    Analysis {data?.narrativeJob ? `is ${data.narrativeJob.status.toLowerCase()} (attempt ${data.narrativeJob.attempt})` : "has not run yet"}. Metrics
                    above are final; the WAVE AI analysis appears here once its job validates —{" "}
                    <Link href="/acquisition/cycle/jobs" className="underline">check Jobs</Link>.
                  </p>
                )}
              </div>
            </Reveal>
          </div>

          <Reveal className="mt-6">
            <div className="rounded-lg border border-accent bg-accent/5 p-6">
              <h2 className="font-heading text-[20px] font-semibold text-navy">Next cycle</h2>
              <p className="mt-1 text-sm text-body">Return to Step 02 with the previous goal or a new one.</p>
              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <Button disabled={busy || !goalId} onClick={() => nextCycle("clone", goalId)}>
                  Use previous goal
                </Button>
                <Button variant="secondary" onClick={() => nextCycle("new")}>
                  Create new goal
                </Button>
              </div>
            </div>
          </Reveal>
        </>
      )}
    </Container>
  );
}
