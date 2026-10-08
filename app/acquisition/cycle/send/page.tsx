"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { Reveal } from "@/components/reveal";

interface Order {
  id: string;
  businessName: string;
  email: string;
  status: string;
  sendId?: string | null;
  deliveryStatus?: string | null;
  sendError?: string | null;
  templateVersion?: number | null;
  messageVariant?: string | null;
}

interface ProviderState {
  selected: string;
  waves: { available: boolean; note: string };
  custom: { connected: boolean; label?: string; keyLast4?: string };
}

export default function ColdMailPage() {
  const [cycles, setCycles] = useState<Array<{ id: string; cycleNumber: number; status: string }>>([]);
  const [cycleId, setCycleId] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [provider, setProvider] = useState<ProviderState | null>(null);
  const [customKey, setCustomKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [drain, setDrain] = useState<any | null>(null);

  async function loadCycles() {
    const res = await fetch("/api/acquisition/cycles");
    if (!res.ok) throw new Error("Could not load cycles.");
    const list = (((await res.json()).cycles ?? []) as Array<{ id: string; cycleNumber: number; status: string }>);
    const open = list.filter((c) => c.status === "ACTIVE");
    setCycles(open);
    if (!cycleId && open.length > 0) setCycleId(open[0].id);
  }

  async function loadQueue(id: string) {
    if (!id) return;
    const res = await fetch(`/api/acquisition/outreach?group=all&cycleId=${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error("Could not load queue.");
    const j = await res.json();
    setOrders(j.orders ?? []);
    setCounts(j.counts ?? {});
  }

  async function loadProvider() {
    const res = await fetch("/api/acquisition/sending/provider");
    if (res.ok) setProvider(await res.json());
  }

  useEffect(() => {
    Promise.all([loadCycles(), loadProvider()]).catch(() => setError("Could not load. Start a cycle from Step 02 first."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadQueue(cycleId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId]);

  async function runDrain() {
    setBusy(true);
    setError(null);
    setDrain(null);
    try {
      const res = await fetch("/api/acquisition/outreach/drain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, limit: 10 }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Drain failed.");
      setDrain(j);
      setNotice(`Queue processed: ${j.sent} sent, ${j.failed} failed, ${j.skipped} skipped.`);
      await loadQueue(cycleId);
    } catch (e: any) {
      setError(e?.message ?? "Drain failed.");
    } finally {
      setBusy(false);
    }
  }

  async function connectCustom() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/acquisition/sending/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", apiKey: customKey }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Connect failed.");
      setNotice(`Custom provider connected (••••${j.keyLast4}). Key stored encrypted.`);
      setCustomKey("");
      await loadProvider();
    } catch (e: any) {
      setError(e?.message ?? "Connect failed.");
    } finally {
      setBusy(false);
    }
  }

  async function selectProvider(p: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/acquisition/sending/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select", provider: p }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Select failed.");
      await loadProvider();
    } catch (e: any) {
      setError(e?.message ?? "Select failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container className="py-8">
      <Reveal className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Step 04 · Cold Mail</p>
        <h1 className="mt-2 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
          Send queue
        </h1>
        <p className="mt-2 text-sm text-body">
          Approved orders send exactly once each. Statuses are honest: SENT means the provider accepted the message —
          delivery is shown only with provider evidence, otherwise unknown.
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
                Wave Cycle {String(c.cycleNumber).padStart(2, "0")}
              </option>
            ))}
          </select>
        </label>
        <Button disabled={busy || !cycleId} onClick={runDrain}>
          {busy ? "Working…" : "Process queue (up to 10)"}
        </Button>
        {drain ? (
          <span className="font-mono text-[11px] text-muted">
            attempted {drain.attempted} · sent {drain.sent} · failed {drain.failed} · skipped {drain.skipped}
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Reveal>
          <div className="rounded-lg border border-line bg-white p-6">
            <h2 className="font-heading text-[20px] font-semibold text-navy">Queue</h2>
            <p className="mt-1 font-mono text-[11px] text-muted">
              approved {counts.approved ?? 0} · sent {counts.sent ?? 0} · failed {counts.failed ?? 0} · ready{" "}
              {counts.ready ?? 0}
            </p>
            <ul className="mt-4 space-y-2">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 rounded-md border border-line p-3 text-sm">
                  <div>
                    <p className="font-medium text-navy">{o.businessName}</p>
                    <p className="font-mono text-[10px] text-muted">
                      {o.status}
                      {o.templateVersion ? ` · template v${o.templateVersion}` : ""}
                      {o.messageVariant && o.messageVariant !== "default" ? ` · variant ${o.messageVariant}` : ""}
                      {o.deliveryStatus ? ` · ${o.deliveryStatus}` : ""}
                      {o.sendError ? ` · ${o.sendError}` : ""}
                    </p>
                  </div>
                  <Link href="/acquisition/outreach" className="text-xs text-accent underline">
                    Review
                  </Link>
                </li>
              ))}
              {orders.length === 0 ? <p className="text-sm text-muted">Nothing in this cycle yet — import prospects to begin.</p> : null}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="rounded-lg border border-line bg-white p-6">
            <h2 className="font-heading text-[20px] font-semibold text-navy">Sending path</h2>
            {!provider ? (
              <p className="mt-2 text-sm text-muted">Loading…</p>
            ) : (
              <div className="mt-3 space-y-4 text-sm">
                <div className="rounded-md border border-line p-3">
                  <p className="font-medium text-navy">A · Have WAVES do it</p>
                  <p className="mt-1 text-muted">
                    {provider.waves.available
                      ? "WAVES sends via its provider under platform limits. Replies land in your own inbox."
                      : "WAVES sending is not configured right now."}
                  </p>
                  <Button variant="secondary" disabled={busy} onClick={() => selectProvider("waves")} >
                    Use WAVES sending
                  </Button>
                </div>
                <div className="rounded-md border border-line p-3">
                  <p className="font-medium text-navy">B · Connect my email</p>
                  {provider.custom.connected ? (
                    <p className="mt-1 text-muted">
                      Connected ({provider.custom.label} ••••{provider.custom.keyLast4}). Key stored encrypted.
                    </p>
                  ) : (
                    <>
                      <p className="mt-1 text-muted">
                        Your own Resend key. Validated live on connect, encrypted at rest, never shown again.
                      </p>
                      <input
                        type="password"
                        value={customKey}
                        onChange={(e) => setCustomKey(e.target.value)}
                        placeholder="re_…"
                        autoComplete="off"
                        className="mt-2 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy"
                      />
                      <div className="mt-2 flex gap-2">
                        <Button disabled={busy || customKey.trim().length < 10} onClick={connectCustom}>
                          Connect
                        </Button>
                        <Button variant="secondary" disabled={busy} onClick={() => selectProvider("custom")}>
                          Use my key
                        </Button>
                      </div>
                    </>
                  )}
                </div>
                <p className="font-mono text-[10px] text-muted">Selected: {provider.selected}</p>
              </div>
            )}
            <Link href="/acquisition/cycle/responses" className="mt-4 inline-block text-sm text-accent underline">
              Continue to Step 05 · Responses →
            </Link>
          </div>
        </Reveal>
      </div>
    </Container>
  );
}
