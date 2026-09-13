"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-scoped fallback for /signup. Renders a clean, actionable message for
 * unexpected server failures (which are also logged with their digest).
 * Never renders stack traces, query text, or infrastructure details.
 */
export default function SignupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[signup] route error", error?.digest ?? "no-digest");
  }, [error]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-8 shadow-precise text-center">
        <h1 className="text-xl font-semibold tracking-tight text-navy">Something went wrong</h1>
        <p className="mt-2 text-sm text-body">
          We couldn&apos;t load the signup page. Please try again — your information is safe.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="w-full rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-light"
          >
            Try again
          </button>
          <Link href="/login" className="text-sm font-medium text-navy hover:underline">
            Continue with your Waves profile instead
          </Link>
        </div>
      </div>
    </div>
  );
}
