"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "./db";
import { lookupUserByEmail } from "./context";
import bcrypt from "bcryptjs";

export interface ResetRequestResult {
  ok: boolean;
  error?: string;
  message?: string;
}

export async function requestPasswordReset(
  _prev: ResetRequestResult,
  formData: FormData,
): Promise<ResetRequestResult> {
  const emailRaw = formData.get("email");
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const user = await lookupUserByEmail(email);
  // Always return same message to avoid enumeration
  const successMessage = "If that email exists, a reset link has been sent.";
  if (!user) {
    return { ok: true, message: successMessage };
  }

  const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires,
    },
  });

  const callbackUrlRaw = formData.get("callbackUrl");
  const callbackUrl = typeof callbackUrlRaw === "string" ? callbackUrlRaw.trim() : "";
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://wavesco.in";
  let resetUrl = `${baseUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  if (callbackUrl) {
    try {
      const dest = new URL(callbackUrl);
      const allowed = ["wavesco.in", "app.wavesco.in", "www.wavesco.in", "localhost"];
      if (allowed.some((h) => dest.hostname === h || dest.hostname.endsWith("." + h))) {
        resetUrl += `&callbackUrl=${encodeURIComponent(callbackUrl)}`;
      }
    } catch {
      if (callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
        resetUrl += `&callbackUrl=${encodeURIComponent(callbackUrl)}`;
      }
    }
  }

  // Try to send via Resend if configured, otherwise just log (never fail the request)
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.SMTP_FROM ?? "WavesCo <noreply@wavesco.in>";
    if (apiKey) {
      // @ts-ignore — resend is optional, dynamically imported
      const { Resend } = await import("resend" as any);
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from,
        to: [email],
        subject: "Reset your Waves password",
        html: `<div style="font-family: system-ui, sans-serif; padding: 24px;"><h2>Reset your password</h2><p>Click to reset: <a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 1 hour.</p></div>`,
      });
    } else {
      // Never log the tokenized URL: server logs must not carry credentials.
      console.log(`[reset] Resend not configured, reset link generated for ${email}`);
    }
  } catch (e) {
    console.error("[reset] email send failed", e);
    // Still return success to avoid enumeration, but log
  }

  return { ok: true, message: successMessage };
}

export interface ResetPasswordResult {
  ok: boolean;
  error?: string;
}

export async function resetPassword(
  _prev: ResetPasswordResult,
  formData: FormData,
): Promise<ResetPasswordResult> {
  const token = typeof formData.get("token") === "string" ? (formData.get("token") as string).trim() : "";
  const emailRaw = formData.get("email");
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  const password = typeof formData.get("password") === "string" ? (formData.get("password") as string) : "";
  const confirm = typeof formData.get("confirmPassword") === "string" ? (formData.get("confirmPassword") as string) : "";

  if (!token || !email) return { ok: false, error: "Invalid reset link." };
  if (!password || password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (password !== confirm) return { ok: false, error: "Passwords do not match." };
  if (!/[^A-Za-z0-9]/.test(password)) return { ok: false, error: "Use a stronger password." };

  const record = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token } },
  });
  if (!record) return { ok: false, error: "Invalid or expired reset link." };
  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { identifier_token: { identifier: email, token } } }).catch(() => {});
    return { ok: false, error: "Reset link has expired. Please request a new one." };
  }

  const user = await lookupUserByEmail(email);
  if (!user) return { ok: false, error: "Account not found." };

  const passwordHash = await bcrypt.hash(password, 10);
  // Update passwordHash via direct prisma (bypass RLS with tenant context not needed as we have tenantId)
  // Use withTenantContext to respect RLS
  const { withTenantContext } = await import("./context");
  await withTenantContext(user.tenantId, async (tx: any) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
  });

  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: email, token } },
  });

  return { ok: true };
}
