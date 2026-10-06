"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";

/** Approve / Reject buttons for one review order. Real API, loading + error states. */
export function LeadDecisionButtons({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

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
      if (!res.ok) {
        throw new Error(
          res.status === 401 ? "Please sign in again."
          : res.status === 402 ? "Your proof or lease expired — extend access to continue."
          : res.status === 404 ? "This lead no longer exists."
          : res.status === 409 ? (j?.error ?? "Already decided.") : (j?.error ?? "Could not save. Please retry."),
        );
      }
      setDone(decision === "APPROVED" ? "Approved" : "Rejected");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not save. Please retry.");
    } finally {
      setPending(null);
    }
  };

  if (done) return <p className="text-sm font-medium text-navy">{done} ✓</p>;

  return (
    <div className="flex flex-col gap-3 lg:ml-8">
      <Button className="w-full" disabled={!!pending} onClick={() => decide("APPROVED")}>
        {pending === "APPROVED" ? "Approving…" : "Approve"}
      </Button>
      <Button variant="ghost" className="w-full" disabled={!!pending} onClick={() => decide("REJECTED")}>
        {pending === "REJECTED" ? "Rejecting…" : "Reject"}
      </Button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** Manual prospect import. Real persistence; duplicate re-import is safe. */
export function LeadImportForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [business, setBusiness] = useState("");
  const [email, setEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch("/api/acquisition/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business, email, contactName: contactName || undefined, contactRole: contactRole || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const first = Array.isArray((j as any)?.issues) && (j as any).issues.length > 0
          ? String((j as any).issues[0].message)
          : undefined;
        throw new Error(
          res.status === 401 ? "Please sign in again."
          : res.status === 402 ? "Your proof or lease expired — extend access to continue."
          : (first ?? (j as any)?.error ?? "Could not add prospect."),
        );
      }
      setOk((j as any)?.duplicate ? "Prospect already in your queue." : "Prospect added to your queue.");
      setBusiness("");
      setEmail("");
      setContactName("");
      setContactRole("");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not add prospect.");
    } finally {
      setPending(false);
    }
  };

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Add prospect
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-white p-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <input aria-label="Business name" required maxLength={200} value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Business name" className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy" />
        <input aria-label="Work email" required type="email" maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Work email" className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy" />
        <input aria-label="Contact name" maxLength={200} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name (optional)" className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy" />
        <input aria-label="Contact role" maxLength={200} value={contactRole} onChange={(e) => setContactRole(e.target.value)} placeholder="Role (optional)" className="rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy" />
      </div>
      {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}
      {ok && <p role="status" className="mt-3 text-xs text-emerald-700">{ok}</p>}
      <div className="mt-4 flex gap-3">
        <Button type="submit" disabled={pending || !business.trim() || !email.trim()}>
          {pending ? "Adding…" : "Add to queue"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => { setOpen(false); setError(null); setOk(null); }}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
