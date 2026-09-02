import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — WavesCo",
  description: "Continue with your Waves profile. One Waves account. All your products.",
};

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-8 shadow-precise">
        <h1 className="text-2xl font-semibold tracking-tight text-navy">Continue with your Waves profile</h1>
        <p className="mt-2 text-sm text-body">
          Your Waves account is used across Waves. No separate login is required for Acquisition OS.
        </p>
        <p className="mt-1 text-xs text-muted">One Waves account. All your products — including Acquisition OS when rented.</p>

        <Suspense fallback={<div className="mt-6 h-32 animate-pulse rounded bg-muted" />}>
          <LoginForm />
        </Suspense>

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
