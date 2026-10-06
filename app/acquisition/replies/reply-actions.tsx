"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";

/** Schedule a follow-up for a stored reply's prospect. Real persistence. */
export function FollowUpButton({ leadKey, business }: { leadKey: string; business: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const schedule = async () => {
    if (pending || done) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/acquisition/followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadKey, business }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          res.status === 401 ? "Please sign in again."
          : res.status === 402 ? "Your proof or lease expired — extend access to continue."
          : (j as any)?.error ?? "Could not schedule follow-up.",
        );
      }
      setDone(true);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not schedule follow-up.");
    } finally {
      setPending(false);
    }
  };

  if (done) return <p className="text-sm font-medium text-navy">Follow-up scheduled ✓</p>;

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" className="w-full" disabled={pending} onClick={schedule}>
        {pending ? "Scheduling…" : "Follow up"}
      </Button>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
