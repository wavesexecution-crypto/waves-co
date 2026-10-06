"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/button";

/** Starts the 2-day proof. 409 (already used/active) routes to checkout. */
export function TrialStartButton({ label }: { label: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/trial/start", { method: "POST" });
      if (res.status === 409) {
        router.push("/billing");
        return;
      }
      if (res.status === 401) {
        router.push("/login?callbackUrl=/acquisition/billing");
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as any)?.error ?? "Could not start your proof. Please retry.");
      }
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not start your proof. Please retry.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="w-full sm:w-auto">
      <Button onClick={start} disabled={pending} className="w-full sm:w-auto" size="lg">
        {pending ? "Starting…" : label}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
