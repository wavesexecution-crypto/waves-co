"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "./db";
import { withTenantContext } from "./context";
import { clientIpFromHeaders, consumeRateLimit } from "./rate-limit";
import bcrypt from "bcryptjs";

export interface SignupResult {
  ok: boolean;
  error?: string;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * Maps unexpected failures to a user-safe message. NEVER returns Prisma
 * internals (constraint names, query text, error codes) to the client —
 * those are logged server-side only.
 */
function toSignupErrorMessage(): string {
  return "Something went wrong creating your account. Please try again.";
}

function isSlugConflict(err: unknown): boolean {
  const e = err as { code?: string; meta?: { target?: unknown } };
  if (e?.code !== "P2002") return false;
  const target = e?.meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : [String(target ?? "")];
  return fields.includes("slug");
}

/**
 * Resolve the caller's IP for shaping. `headers()` throws when the action runs
 * outside a request scope (tests, background invocation), so degrade to a
 * stable sentinel instead of failing the request.
 */
async function callerIp(): Promise<string> {
  try {
    return clientIpFromHeaders(await headers());
  } catch {
    return "no-request-scope";
  }
}

/** Creates tenant + user atomically. Two companies may share a display name,
 *  so slug collisions are resolved with a unique suffix and a FRESH
 *  transaction per attempt: Postgres aborts the enclosing transaction on the
 *  first failed statement, so retrying inside the same transaction can never
 *  succeed. Each attempt is still all-or-nothing (no partial workspaces). */
async function createAccountAtomically(
  tenantId: string,
  userId: string,
  tenantName: string,
  email: string,
  name: string,
  passwordHash: string,
): Promise<void> {
  const base = slugify(tenantName) || "workspace";
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomUUID().replace(/-/g, "").slice(0, 6)}`;
    try {
      await withTenantContext(tenantId, async (tx: any) => {
        await tx.tenant.create({
          data: { id: tenantId, name: tenantName, slug },
        });
        await tx.user.create({
          // emailVerified stays null: there is no verification-mail flow yet
          // (requires the email provider key), so signup must NOT assert a
          // verified address. Nothing in the codebase treats this field as
          // proof; trial-farming defense rests on signup rate limits,
          // duplicate-email rejection, and single-use trial entitlements.
          data: { id: userId, tenantId, email, name: name || null, passwordHash, role: "owner", status: "active", emailVerified: null },
        });
      });
      return;
    } catch (e) {
      if (isSlugConflict(e) && attempt < 2) continue;
      throw e;
    }
  }
  throw new Error("Could not allocate a workspace slug");
}

export async function signupAction(_prevState: SignupResult, formData: FormData): Promise<SignupResult> {
  // Rate limit on the caller IP before touching the database. Signup is the
  // entry point for disposable-account trial farming.
  const ip = await callerIp();
  const limit = consumeRateLimit(ip, "signup");
  if (!limit.allowed) {
    return { ok: false, error: "Too many accounts created from this network. Please contact support." };
  }

  const tenantName = typeof formData.get("tenantName") === "string" ? (formData.get("tenantName") as string).trim() : "";
  const name = typeof formData.get("name") === "string" ? (formData.get("name") as string).trim() : "";
  const email = typeof formData.get("email") === "string" ? (formData.get("email") as string).trim().toLowerCase() : "";
  const password = typeof formData.get("password") === "string" ? (formData.get("password") as string) : "";

  if (!tenantName || !email || !password) return { ok: false, error: "Business name, email and password are required." };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (!/[^A-Za-z0-9]/.test(password)) return { ok: false, error: "Use a stronger password." };

  // Use the SECURITY DEFINER function to check for duplicate email (bypasses RLS)
  const { lookupUserByEmail } = await import("./context");
  const existing = await lookupUserByEmail(email);
  if (existing) return { ok: false, error: "An account with this email already exists." };

  const tenantId = `tenant_${randomUUID().replace(/-/g, "")}`;
  const userId = `user_${randomUUID().replace(/-/g, "")}`;
  const passwordHash = await bcrypt.hash(password, 10);

  // Create tenant + user atomically: either both rows exist or neither does
  // (no half-created workspaces on failure).
  // Every unexpected failure returns a clean message — the app has no error
  // boundary on this route, so a throw would become a full-page crash.
  try {
    await createAccountAtomically(tenantId, userId, tenantName, email, name, passwordHash);
  } catch (e) {
    // Server-side signal only: constraint target, never query text/params
    // (which would include the password hash).
    const err = e as { code?: string; meta?: { target?: unknown } };
    console.error("[signup] account creation failed", { code: err?.code ?? "unknown", target: err?.meta?.target ?? null });
    return { ok: false, error: toSignupErrorMessage() };
  }

  return { ok: true };
}
