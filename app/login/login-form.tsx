"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    setPending(false);
    if (result?.error) {
      setError("Incorrect email or password.");
      return;
    }
    const callbackUrl = searchParams.get("callbackUrl");
    let safe: string | null = null;
    if (callbackUrl) {
      if (callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
        safe = callbackUrl;
      } else {
        try {
          const dest = new URL(callbackUrl);
          const allowed = ["wavesco.in", "app.wavesco.in", "www.wavesco.in", "localhost"];
          if (allowed.some((h) => dest.hostname === h || dest.hostname.endsWith("." + h))) {
            safe = callbackUrl;
          }
        } catch {}
      }
    }
    const dest = safe ?? "/";
    if (dest.startsWith("http")) {
      window.location.href = dest;
    } else {
      router.push(dest);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="text-sm font-medium text-navy">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium text-navy">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy"
        />
      </div>
      {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
      <button type="submit" disabled={pending} className="w-full rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-light disabled:opacity-50">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
