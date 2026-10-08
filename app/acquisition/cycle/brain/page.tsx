"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { Reveal } from "@/components/reveal";

interface BrainState {
  brain: any | null;
  hasIntakeProfile: boolean;
  obsidian: { state: string; detail?: string | null; lastOkAt?: string | null };
}

export default function BrainPage() {
  const [state, setState] = useState<BrainState | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/acquisition/brain");
    if (res.ok) setState(await res.json());
  }

  useEffect(() => {
    refresh().catch(() => setError("Could not load Company Brain."));
  }, []);

  async function submit(action: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/acquisition/brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "markdown" ? { action: "from-markdown", markdown } : { action: "from-intake" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Save failed.");
      setNotice(`Saved from ${action === "markdown" ? "Obsidian import" : "intake"} (v${j.brain.version}).`);
      setMarkdown("");
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  const payload = state?.brain?.payload;
  return (
    <Container className="py-8">
      <Reveal className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Step 01 · Company Brain</p>
        <h1 className="mt-2 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
          Company Brain
        </h1>
        <p className="mt-2 text-sm text-body">
          Persistent understanding of your company. Intake and Obsidian imports produce the same structure — the rest of
          the OS never cares which path you used.
        </p>
      </Reveal>

      {error ? <p role="alert" className="mb-4 text-sm text-error">{error}</p> : null}
      {notice ? <p className="mb-4 text-sm text-success">{notice}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal>
          <div className="rounded-lg border border-line bg-white p-6">
            <h2 className="font-heading text-[20px] font-semibold text-navy">Option A · Complete intake</h2>
            <p className="mt-1 text-sm text-muted">
              {state?.hasIntakeProfile
                ? "Intake profile on file — saving rebuilds the Brain from it."
                : "No intake profile yet — complete onboarding first."}
            </p>
            <Button className="mt-4" disabled={busy || !state?.hasIntakeProfile} onClick={() => submit("intake")}>
              {busy ? "Saving…" : "Build Brain from intake"}
            </Button>
            {!state?.hasIntakeProfile ? (
              <Link href="/acquisition/onboarding" className="ml-3 text-sm text-accent underline">
                Go to onboarding
              </Link>
            ) : null}
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="rounded-lg border border-line bg-white p-6">
            <h2 className="font-heading text-[20px] font-semibold text-navy">Option B · Connect Obsidian</h2>
            <p className="mt-1 text-sm text-muted">
              Paste vault markdown (or an export). Parsed deterministically into the same structure — no fake
              connection: status shows connected only after a real import.{" "}
              {state?.obsidian?.state === "connected" ? `Connected (${state.obsidian.detail ?? "markdown import"}).` : "Not connected."}
            </p>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              rows={6}
              placeholder={"# Acme Widgets\n## Offer\n- Done-for-you outreach\n## Ideal customer\n- Roles: VP Sales"}
              className="mt-4 w-full rounded-md border border-line bg-white px-3 py-2 font-mono text-xs outline-none focus:border-navy"
            />
            <Button className="mt-4" disabled={busy || markdown.trim().length < 20} onClick={() => submit("markdown")}>
              {busy ? "Saving…" : "Import into Brain"}
            </Button>
          </div>
        </Reveal>
      </div>

      {payload ? (
        <Reveal delay={0.1} className="mt-6">
          <div className="rounded-lg border border-line bg-white p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-[20px] font-semibold text-navy">Current Brain</h2>
              <span className="font-mono text-[11px] text-muted">
                {state?.brain?.source} · v{state?.brain?.version} · {state?.brain?.status}
              </span>
            </div>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase text-muted">Company</dt>
                <dd className="mt-1 text-sm text-navy">{payload.company?.name || "—"}</dd>
                <dd className="text-sm text-muted">{[payload.company?.industry, payload.company?.website].filter(Boolean).join(" · ")}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted">Offering</dt>
                <dd className="mt-1 text-sm text-navy">{payload.offering?.whatWeSell || payload.offering?.offer || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted">ICP</dt>
                <dd className="mt-1 text-sm text-navy">{[...(payload.icp?.roles ?? []), ...(payload.icp?.industries ?? [])].join(", ") || "—"}</dd>
                {payload.icp?.painPoints ? <dd className="text-sm text-muted">{payload.icp.painPoints}</dd> : null}
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-muted">Positioning</dt>
                <dd className="mt-1 text-sm text-navy">{payload.positioning?.angle || "—"}</dd>
              </div>
            </dl>
            <Link href="/acquisition/cycle/goal" className="mt-6 inline-block text-sm text-accent underline">
              Continue to Step 02 · Goal →
            </Link>
          </div>
        </Reveal>
      ) : null}
    </Container>
  );
}
