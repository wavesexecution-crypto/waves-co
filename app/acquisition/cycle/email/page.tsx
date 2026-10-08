"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { Reveal } from "@/components/reveal";

interface Template {
  id: string;
  cycleId: string;
  version: number;
  subject: string;
  opening?: string | null;
  body: string;
  cta?: string | null;
  status: string;
  source: string;
}

interface Cycle {
  id: string;
  cycleNumber: number;
  status: string;
}

export default function EmailDesignPage() {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [genState, setGenState] = useState<string | null>(null);

  async function loadCycles() {
    const res = await fetch("/api/acquisition/cycles");
    if (!res.ok) throw new Error("Could not load cycles.");
    const j = await res.json();
    const list = (j.cycles ?? []).filter((c: Cycle) => c.status === "ACTIVE");
    setCycles(list);
    if (!cycleId && list.length > 0) setCycleId(list[0].id);
  }

  async function loadTemplates(id: string) {
    if (!id) return;
    const res = await fetch(`/api/acquisition/templates?cycleId=${encodeURIComponent(id)}`);
    if (res.ok) setTemplates(((await res.json()).templates ?? []) as Template[]);
  }

  useEffect(() => {
    loadCycles().catch(() => setError("Could not load cycles. Start one from Step 02 first."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadTemplates(cycleId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId]);

  async function saveManual() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/acquisition/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, subject: subject.trim(), body: body.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Save failed.");
      setNotice(`Saved as version ${j.template.version}.`);
      setSubject("");
      setBody("");
      await loadTemplates(cycleId);
    } catch (e: any) {
      setError(e?.message ?? "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    setError(null);
    setGenState("Saving a deterministic draft first — WAVE AI variants follow…");
    try {
      const res = await fetch("/api/acquisition/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, generate: true }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Generate failed.");
      setGenState(
        j.generationJob
          ? `Deterministic v${j.template.version} saved. WAVE AI job ${j.generationJob.status} — check Jobs for progress.`
          : `Deterministic v${j.template.version} saved.`,
      );
      await loadTemplates(cycleId);
    } catch (e: any) {
      setError(e?.message ?? "Generate failed.");
      setGenState(null);
    } finally {
      setBusy(false);
    }
  }

  async function approve(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/acquisition/templates/${id}/approve`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Approve failed.");
      setNotice("Approved. New edits create new versions — approved history never changes.");
      await loadTemplates(cycleId);
    } catch (e: any) {
      setError(e?.message ?? "Approve failed.");
    } finally {
      setBusy(false);
    }
  }

  const approved = templates.find((t) => t.status === "approved") ?? null;

  return (
    <Container className="py-8">
      <Reveal className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Step 03 · Email Design</p>
        <h1 className="mt-2 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
          Design once, approve once
        </h1>
        <p className="mt-2 text-sm text-body">
          One approved message per cycle. Later edits create new versions here or in Settings — approved history is
          never rewritten.
        </p>
      </Reveal>

      {error ? <p role="alert" className="mb-4 text-sm text-error">{error}</p> : null}
      {notice ? <p className="mb-4 text-sm text-success">{notice}</p> : null}
      {genState ? <p className="mb-4 text-sm text-body">{genState}</p> : null}

      <div className="mb-6 flex items-center gap-3">
        <label className="text-sm font-medium text-navy">
          Cycle{" "}
          <select
            value={cycleId}
            onChange={(e) => setCycleId(e.target.value)}
            className="ml-2 rounded-md border border-line bg-white px-3 py-2 text-sm outline-none"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id}>
                Wave Cycle {String(c.cycleNumber).padStart(2, "0")}
              </option>
            ))}
          </select>
        </label>
        <Button variant="secondary" disabled={busy || !cycleId} onClick={generate}>
          Generate (draft + WAVE AI)
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal>
          <div className="rounded-lg border border-line bg-white p-6">
            <h2 className="font-heading text-[20px] font-semibold text-navy">Write a version</h2>
            <p className="mt-1 text-sm text-muted">
              Tokens available: {"{{businessName}}"} {"{{contactName}}"} {"{{companyName}}"} {"{{opportunity}}"}
            </p>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="mt-4 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder="Email body…"
              className="mt-3 w-full rounded-md border border-line bg-white px-3 py-2 font-mono text-xs outline-none focus:border-navy"
            />
            <Button className="mt-4" disabled={busy || !cycleId || subject.trim().length < 3 || body.trim().length < 20} onClick={saveManual}>
              {busy ? "Saving…" : "Save as new version"}
            </Button>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="rounded-lg border border-line bg-white p-6">
            <h2 className="font-heading text-[20px] font-semibold text-navy">Versions</h2>
            {approved ? (
              <p className="mt-1 text-sm text-success">v{approved.version} approved{approved.source === "ai" ? " (WAVE AI)" : ""}.</p>
            ) : (
              <p className="mt-1 text-sm text-muted">No approved version yet for this cycle.</p>
            )}
            <ul className="mt-4 space-y-3">
              {templates.map((t) => (
                <li key={t.id} className="rounded-md border border-line p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-navy">
                      v{t.version} · {t.status} · {t.source}
                    </p>
                    {t.status !== "approved" ? (
                      <Button variant="secondary" disabled={busy} onClick={() => approve(t.id)}>
                        Approve
                      </Button>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm font-medium text-navy">{t.subject}</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{t.body.slice(0, 400)}{t.body.length > 400 ? "…" : ""}</p>
                </li>
              ))}
              {templates.length === 0 ? <p className="text-sm text-muted">No versions yet.</p> : null}
            </ul>
            <Link href="/acquisition/cycle/send" className="mt-4 inline-block text-sm text-accent underline">
              Continue to Step 04 · Cold Mail →
            </Link>
          </div>
        </Reveal>
      </div>
    </Container>
  );
}
