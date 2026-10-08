"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { Reveal } from "@/components/reveal";

interface Direction {
  id: string;
  kind: string;
  customText?: string | null;
  draftResponse?: string | null;
  status: string;
}

interface Report {
  id: string;
  orderId: string;
  leadKey?: string | null;
  prospectName?: string | null;
  company?: string | null;
  replyText?: string | null;
  replyReceivedAt?: string | null;
  replyStatus: string;
  intent: string;
  sentiment: string;
  summary?: string | null;
  signals?: string[] | null;
  objections?: string[] | null;
  askingFor?: string | null;
  recommendedAction?: string | null;
  source: string;
  takenOverAt?: string | null;
  directions: Direction[];
}

export default function ResponsesPage() {
  const [cycles, setCycles] = useState<Array<{ id: string; cycleNumber: number; status: string }>>([]);
  const [cycleId, setCycleId] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [orderId, setOrderId] = useState("");
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dirKind, setDirKind] = useState("answer");
  const [dirText, setDirText] = useState("");
  const [takeover, setTakeover] = useState<any | null>(null);

  async function loadCycles() {
    const res = await fetch("/api/acquisition/cycles");
    if (!res.ok) throw new Error("Could not load cycles.");
    const list = (((await res.json()).cycles ?? []) as Array<{ id: string; cycleNumber: number; status: string }>);
    const open = list.filter((c) => c.status === "ACTIVE");
    setCycles(open);
    if (!cycleId && open.length > 0) setCycleId(open[0].id);
  }

  async function loadReports(id: string) {
    if (!id) return;
    const res = await fetch(`/api/acquisition/reply-reports?cycleId=${encodeURIComponent(id)}`);
    if (res.ok) setReports(((await res.json()).reports ?? []) as Report[]);
  }

  useEffect(() => {
    loadCycles().catch(() => setError("Could not load. Start a cycle from Step 02 first."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadReports(cycleId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId]);

  async function record() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/acquisition/reply-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderId.trim(), replyText: replyText.trim() || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Record failed.");
      setNotice("Reply recorded. Classification runs as a job — refresh to see it.");
      setOrderId("");
      setReplyText("");
      await loadReports(cycleId);
    } catch (e: any) {
      setError(e?.message ?? "Record failed.");
    } finally {
      setBusy(false);
    }
  }

  async function direct(reportId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/acquisition/reply-reports/${reportId}/direction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: dirKind, customText: dirKind === "custom" ? dirText : undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Direction failed.");
      setNotice("Direction saved. A response draft will appear here once its job completes — drafts are never auto-sent.");
      await loadReports(cycleId);
    } catch (e: any) {
      setError(e?.message ?? "Direction failed.");
    } finally {
      setBusy(false);
    }
  }

  async function takeOver(reportId: string) {
    setBusy(true);
    setError(null);
    setTakeover(null);
    try {
      const res = await fetch(`/api/acquisition/reply-reports/${reportId}/takeover`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Takeover failed.");
      setTakeover(j);
      await loadReports(cycleId);
    } catch (e: any) {
      setError(e?.message ?? "Takeover failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container className="py-8">
      <Reveal className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Step 05 · Responses</p>
        <h1 className="mt-2 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
          No reply · Reply
        </h1>
        <p className="mt-2 text-sm text-body">
          No reply: leave it, or schedule a manual follow-up. Reply: record it, get Reply Intelligence, then give WAVES
          a direction or take over yourself. Only recorded replies ever appear here.
        </p>
      </Reveal>

      {error ? <p role="alert" className="mb-4 text-sm text-error">{error}</p> : null}
      {notice ? <p className="mb-4 text-sm text-success">{notice}</p> : null}

      <div className="mb-6">
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Reveal>
          <div className="rounded-lg border border-line bg-white p-6">
            <h2 className="font-heading text-[20px] font-semibold text-navy">Record a reply</h2>
            <p className="mt-1 text-sm text-muted">
              Replies arrive in your own inbox today — paste one here to start Reply Intelligence for that prospect.
            </p>
            <input
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="Order ID (from the Outreach page)"
              className="mt-4 w-full rounded-md border border-line bg-white px-3 py-2 font-mono text-xs outline-none focus:border-navy"
            />
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              rows={5}
              placeholder="Paste the prospect's reply…"
              className="mt-3 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy"
            />
            <Button className="mt-4" disabled={busy || !orderId.trim()} onClick={record}>
              {busy ? "Recording…" : "Record reply"}
            </Button>
            <div className="mt-6 border-t border-line pt-4">
              <h3 className="text-sm font-medium text-navy">No reply?</h3>
              <p className="mt-1 text-sm text-muted">Leave it — or schedule a manual follow-up from the Outreach page.</p>
              <Link href="/acquisition/outreach" className="mt-2 inline-block text-sm text-accent underline">
                Open Outreach →
              </Link>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="rounded-lg border border-line bg-white p-6">
            <h2 className="font-heading text-[20px] font-semibold text-navy">Reply Intelligence</h2>
            {reports.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No recorded replies in this cycle yet.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {reports.map((r) => (
                  <li key={r.id} className="rounded-md border border-line p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-navy">{r.company || r.prospectName || r.orderId}</p>
                      <span className="rounded bg-navy/10 px-2 py-0.5 font-mono text-[10px] text-navy">{r.replyStatus}</span>
                    </div>
                    {r.summary ? <p className="mt-2 text-sm text-body">{r.summary}</p> : <p className="mt-2 text-xs text-muted">Classification pending — refresh shortly.</p>}
                    <p className="mt-1 font-mono text-[10px] text-muted">
                      intent {r.intent} · sentiment {r.sentiment}
                      {r.takenOverAt ? " · client-controlled" : ""}
                    </p>
                    {r.directions.map((d) => (
                      <div key={d.id} className="mt-2 rounded bg-paper p-3 text-xs">
                        <p className="font-medium text-navy">Direction: {d.kind} · {d.status}</p>
                        {d.draftResponse ? <p className="mt-1 whitespace-pre-wrap text-body">{d.draftResponse}</p> : <p className="mt-1 text-muted">Draft pending (job).</p>}
                      </div>
                    ))}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <select value={dirKind} onChange={(e) => setDirKind(e.target.value)} className="rounded-md border border-line bg-white px-2 py-1.5 text-xs outline-none">
                        <option value="answer">Answer questions</option>
                        <option value="qualify">Qualify further</option>
                        <option value="inform">Send information</option>
                        <option value="book">Book a call</option>
                        <option value="custom">Custom direction</option>
                      </select>
                      {dirKind === "custom" ? (
                        <input value={dirText} onChange={(e) => setDirText(e.target.value)} placeholder="Your instruction…" className="rounded-md border border-line bg-white px-2 py-1.5 text-xs outline-none" />
                      ) : null}
                      <Button variant="secondary" disabled={busy} onClick={() => direct(r.id)}>
                        Give WAVES a direction
                      </Button>
                      <Button variant="secondary" disabled={busy} onClick={() => takeOver(r.id)}>
                        Take over
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Reveal>
      </div>

      {takeover ? (
        <Reveal className="mt-6">
          <div className="rounded-lg border border-accent bg-accent/5 p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Client control mode</p>
            <h2 className="mt-1 font-heading text-[22px] font-semibold text-navy">Conversation context</h2>
            <div className="mt-3 grid gap-4 text-sm lg:grid-cols-2">
              <div>
                <p className="font-medium text-navy">Original message</p>
                <p className="mt-1 text-body">{takeover.conversation?.originalMessage?.subject}</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{takeover.conversation?.originalMessage?.body?.slice(0, 600)}</p>
              </div>
              <div>
                <p className="font-medium text-navy">Prospect reply</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-body">{takeover.conversation?.prospectReply?.text?.slice(0, 600) ?? "—"}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">
              Intent {takeover.conversation?.intelligence?.intent} · {takeover.conversation?.intelligence?.sentiment} ·
              Recommended: {takeover.conversation?.intelligence?.recommendedAction ?? "—"}
            </p>
            <p className="mt-2 text-xs text-body">
              You are in control. Act from this context: schedule a manual follow-up, or give WAVES a direction above.
            </p>
          </div>
        </Reveal>
      ) : null}

      <Link href="/acquisition/cycle/report" className="mt-6 inline-block text-sm text-accent underline">
        Continue to Step 06 · Cycle Report →
      </Link>
    </Container>
  );
}
