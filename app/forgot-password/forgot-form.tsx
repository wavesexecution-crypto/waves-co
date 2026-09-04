"use client";

import { useActionState } from "react";
import { requestPasswordReset, type ResetRequestResult } from "@/lib/reset";
import { useSearchParams } from "next/navigation";

const initial: ResetRequestResult = { ok: false };

export function ForgotForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [state, action, pending] = useActionState(requestPasswordReset, initial);
  return (
    <form action={action} className="mt-6 space-y-4">
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
      <div>
        <label htmlFor="email" className="text-sm font-medium text-navy">Email</label>
        <input id="email" name="email" type="email" required placeholder="you@company.com" className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy" />
      </div>
      {state.error ? <p className="text-sm text-error">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-green-600">{state.message}</p> : null}
      <button type="submit" disabled={pending} className="w-full rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-light disabled:opacity-50">
        {pending ? "Sending..." : "Send reset link"}
      </button>
    </form>
  );
}
