"use client";

import { useActionState } from "react";
import { resetPassword, type ResetPasswordResult } from "@/lib/reset";
import { useRouter } from "next/navigation";

const initial: ResetPasswordResult = { ok: false };

export function ResetPasswordForm({ token, email, callbackUrl }: { token: string; email: string; callbackUrl?: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(async (prev: ResetPasswordResult, fd: FormData) => {
    const r = await resetPassword(prev, fd);
    if (r.ok) {
      const dest = callbackUrl ? `/login?reset=success&callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login?reset=success";
      router.push(dest);
    }
    return r;
  }, initial);

  if (!token || !email) {
    return <p className="mt-6 text-sm text-error">Invalid reset link. Please request a new one from <a href="/forgot-password" className="underline">forgot password</a>.</p>;
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
      <div>
        <label htmlFor="password" className="text-sm font-medium text-navy">New password</label>
        <input id="password" name="password" type="password" required minLength={8} placeholder="8+ chars" className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy" />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="text-sm font-medium text-navy">Confirm password</label>
        <input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy" />
      </div>
      {state.error ? <p className="text-sm text-error">{state.error}</p> : null}
      <button type="submit" disabled={pending} className="w-full rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-light disabled:opacity-50">
        {pending ? "Saving..." : "Update password"}
      </button>
    </form>
  );
}
