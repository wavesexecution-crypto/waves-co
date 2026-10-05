"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { LEASE_TYPE_BY_DAYS } from "@/lib/leases";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type RazorpayPaymentResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

const LEASE_TYPE: Record<number, string> = LEASE_TYPE_BY_DAYS as Record<number, string>;

type Status = "idle" | "creating" | "paying" | "verifying" | "done" | "error";

function loadRazorpayCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(!!window.Razorpay), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(!!window.Razorpay);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

function formatINR(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/**
 * Client checkout for an Acquisition OS lease.
 *
 * SECURITY: this component only ever receives the PUBLIC Razorpay key ID
 * (required by checkout.js). The key secret stays in server-side env vars
 * and is used exclusively by the API routes / lib/razorpay.ts.
 */
export function CheckoutButton({ days, amountPaise }: { days: number; amountPaise: number }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  const busy = status === "creating" || status === "paying" || status === "verifying";

  const handleClick = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setStatus("creating");
    try {
      const leaseType = LEASE_TYPE[days];
      if (!leaseType) {
        setError(`Unsupported lease: ${days} days`);
        setStatus("error");
        return;
      }

      // 1) Acquisition OS → create Razorpay order (server-side, price locked server-side)
      const res = await fetch("/api/billing/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaseType, idempotencyKey: crypto.randomUUID() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setError("Please sign in to lease Acquisition OS.");
        setStatus("error");
        return;
      }
      if (res.status === 503 || res.status === 400) {
        setError(data?.error === "payment_provider_not_configured" ? "Payments are not configured yet. Please try again shortly." : (data?.error ?? "Unable to create order."));
        setStatus("error");
        return;
      }
      if (!res.ok || !data?.razorpayOrder?.id || !data?.keyId) {
        setError("Unable to create order. Please try again.");
        setStatus("error");
        return;
      }

      // 2) Razorpay Checkout — keyId is the PUBLIC key ID (the secret never leaves the server)
      setStatus("paying");
      const loaded = await loadRazorpayCheckout();
      if (!loaded || !window.Razorpay) {
        setError("Razorpay checkout failed to load. Please retry.");
        setStatus("error");
        return;
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        order_id: data.razorpayOrder.id,
        name: "WavesCo",
        description: `${days}-day Acquisition OS lease`,
        currency: "INR",
        handler: async (response: RazorpayPaymentResponse) => {
          // 3) Payment verification (server-side HMAC + capture check)
          setStatus("verifying");
          const vres = await fetch("/api/billing/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const vdata = await vres.json().catch(() => ({}));
          if (!vres.ok) {
            setError(vdata?.error ?? "Payment could not be verified. Please contact support.");
            setStatus("error");
            return;
          }
          setStatus("done");
          router.refresh();
        },
        modal: {
          ondismiss: () => {
            setStatus("idle");
          },
        },
        theme: { color: "#0e1f3f" },
      });
      rzp.open();
    } catch {
      setError("Something went wrong. Please retry.");
      setStatus("error");
    } finally {
      busyRef.current = false;
    }
  }, [days, router]);

  const label =
    status === "creating" ? "Creating order…" :
    status === "paying" ? "Payment opened…" :
    status === "verifying" ? "Verifying payment…" :
    status === "done" ? "Lease active ✓" :
    status === "error" ? "Retry lease" :
    `Pay ${formatINR(amountPaise)}`;

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={handleClick}
        className={`focus-ring inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm border px-6 text-sm font-semibold leading-none transition-all duration-200 ${
          status === "done"
            ? "border-emerald-500/40 bg-emerald-50 text-emerald-700"
            : status === "error"
              ? "border-line bg-white text-navy hover:-translate-y-0.5 hover:bg-paper"
              : "border-accent bg-accent text-navy-dark shadow-sm hover:-translate-y-0.5 hover:bg-accent-hover"
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {busy && (
          <span aria-hidden="true" className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        <span>{label}</span>
      </button>
      {error && <p role="alert" className="mt-2 text-xs leading-5 text-red-600">{error}</p>}
      <p className="mt-2 text-[11px] text-muted">Payment processed securely by Razorpay. No auto-renewal.</p>
    </div>
  );
}