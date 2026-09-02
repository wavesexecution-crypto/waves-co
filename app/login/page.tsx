"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";

export default function LoginPage() {
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
    const safe = callbackUrl?.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
    router.push(safe);
    router.refresh();
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-8 shadow-precise">
        <h1 className="text-2xl font-semibold tracking-tight text-navy">Continue with your Waves profile</h1>
        <p className="mt-2 text-sm text-body">
          Your Waves account is used across Waves. No separate login is required for Acquisition OS.
        </p>
        <p className="mt-1 text-xs text-muted">One Waves account. All your products — including Acquisition OS when rented.</p>

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
            {pending ? "Signing in…" : "Continue to Waves"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          No account yet?{" "}
          <Link href="/architecture-audit" className="font-medium text-navy hover:underline">
            Book Architecture Review
          </Link>
        </p>
        <p className="mt-3 text-center text-xs text-muted">Login happens on the main Waves site. app.wavesco.in does not have an independent customer login.</p>
      </div>
    </div>
  );
}
