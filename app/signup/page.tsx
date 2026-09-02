import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create account — WavesCo",
  description: "One Waves account. All your products.",
};

export default function SignupPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-8 shadow-precise">
        <h1 className="text-2xl font-semibold tracking-tight text-navy">Create your Waves account</h1>
        <p className="mt-2 text-sm text-body">One Waves account. All your products — including Acquisition OS when rented.</p>
        <Suspense>
          <SignupForm />
        </Suspense>
        <p className="mt-4 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-navy hover:underline">
            Continue with your Waves profile
          </Link>
        </p>
      </div>
    </div>
  );
}
