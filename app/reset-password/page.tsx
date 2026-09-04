import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Reset password — WavesCo" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; email?: string; callbackUrl?: string }> }) {
  const params = await searchParams;
  const token = params.token ?? "";
  const email = params.email ?? "";
  const callbackUrl = params.callbackUrl ?? "";
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-8 shadow-precise">
        <h1 className="text-2xl font-semibold tracking-tight text-navy">Set a new password</h1>
        <p className="mt-2 text-sm text-body">One Waves account across all platforms. This will update your password for wavesco.in and app.wavesco.in.</p>
        <ResetPasswordForm token={token} email={email} callbackUrl={callbackUrl} />
      </div>
    </div>
  );
}
