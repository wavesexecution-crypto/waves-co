"use client";

import { useActionState } from "react";
import { signupAction, type SignupResult } from "@/lib/signup";
import { useRouter } from "next/navigation";

const initialState: SignupResult = { ok: false };

export function SignupForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(async (prev: SignupResult, formData: FormData) => {
    const res = await signupAction(prev, formData);
    if (res.ok) {
      router.push("/login");
    }
    return res;
  }, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label htmlFor="tenantName" className="text-sm font-medium text-navy">Business name</label>
        <input id="tenantName" name="tenantName" required placeholder="WavesCo HQ" autoComplete="organization" className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy" />
      </div>
      <div>
        <label htmlFor="name" className="text-sm font-medium text-navy">Your name</label>
        <input id="name" name="name" placeholder="Jane Doe" autoComplete="name" className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy" />
      </div>
      <div>
        <label htmlFor="email" className="text-sm font-medium text-navy">Email</label>
        <input id="email" name="email" type="email" required placeholder="you@company.com" autoComplete="email" className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy" />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium text-navy">Password</label>
        <input id="password" name="password" type="password" required minLength={8} placeholder="8+ chars" autoComplete="new-password" className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy" />
      </div>
      {state.error ? <p role="alert" className="text-sm text-error">{state.error}</p> : null}
      <button type="submit" disabled={isPending} className="w-full rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-light disabled:opacity-50">
        {isPending ? "Creating account…" : "Create Waves account"}
      </button>
    </form>
  );
}
