"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";

function friendlyError(res: Response, j: any, fallback: string): string {
  if (res.status === 401) return "Please sign in again.";
  if (res.status === 402) return "Your proof or lease expired — extend access to continue.";
  if (res.status === 404) return "This order no longer exists.";
  if (res.status === 409) return j?.error ?? "Already decided.";
  return j?.error ?? fallback;
}

/** Approve (→ APPROVED) or reject (→ REJECTED) a review order. */
export function OrderDecisionButtons({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (decision: "APPROVED" | "REJECTED") => {
    if (pending) return;
    setPending(decision);
    setError(null);
    try {
      const res = await fetch("/api/acquisition/leads/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, decision }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(friendlyError(res, j, "Could not save. Please retry."));
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not save. Please retry.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 lg:ml-8">
      <Button className="w-full" disabled={!!pending} onClick={() => decide("APPROVED")}>
        {pending === "APPROVED" ? "Approving…" : "Approve"}
      </Button>
      <Button variant="ghost" className="w-full" disabled={!!pending} onClick={() => decide("REJECTED")}>
        {pending === "REJECTED" ? "Rejecting…" : "Don't send"}
      </Button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** Send one APPROVED order. Only provider-confirmed sends read as sent. */
export function OrderSendButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/acquisition/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(friendlyError(res, j, "Could not send. Please retry."));
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not send. Please retry.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 lg:ml-8">
      <Button className="w-full" disabled={pending} onClick={send}>
        {pending ? "Sending…" : "Send now"}
      </Button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-muted">Sends only after your approval. Retries never duplicate.</p>
    </div>
  );
}

/** Sequentially send all approved orders (idempotent per order). */
export function SendAllButton({ orderIds }: { orderIds: string[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const sendAll = async () => {
    if (pending || orderIds.length === 0) return;
    setPending(true);
    setError(null);
    setSummary(null);
    let sent = 0;
    let failed = 0;
    try {
      for (const orderId of orderIds) {
        const res = await fetch("/api/acquisition/outreach/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const j = await res.json().catch(() => ({}));
        if (res.ok && (j as any)?.order?.status === "SENT") sent += 1;
        else failed += 1;
      }
      setSummary(`Sent ${sent}, failed ${failed}.`);
      router.refresh();
    } catch {
      setError("Sending stopped partway — sent items are recorded, retry for the rest.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <Button disabled={pending || orderIds.length === 0} onClick={sendAll}>
        {pending ? "Sending…" : `Send all ${orderIds.length} emails`}
      </Button>
      {summary && <p role="status" className="text-xs text-body">{summary}</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
