import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = {
  title: "Forgot password — WavesCo",
};

export default async function ForgotPage({ searchParams }: { searchParams?: Promise<{ callbackUrl?: string }> }) {
  const params = await searchParams;
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-8 shadow-precise">
        <h1 className="text-2xl font-semibold tracking-tight text-navy">Forgot password?</h1>
        <p className="mt-2 text-sm text-body">Enter your email and we&apos;ll send a reset link. One Waves account works everywhere — including app.wavesco.in.</p>
        <Suspense>
          <ForgotForm />
        </Suspense>
        <p className="mt-4 text-center text-sm text-muted">
          Remembered? <Link href="/login" className="font-medium text-navy hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
