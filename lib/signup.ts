"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "./db";
import { withTenantContext } from "./context";
import bcrypt from "bcryptjs";

export interface SignupResult {
  ok: boolean;
  error?: string;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function signupAction(_prevState: SignupResult, formData: FormData): Promise<SignupResult> {
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

  // Create tenant + user inside RLS context
  await withTenantContext(tenantId, async (tx: any) => {
    await tx.tenant.create({
      data: { id: tenantId, name: tenantName, slug: slugify(tenantName) },
    });
    await tx.user.create({
      data: { id: userId, tenantId, email, name: name || null, passwordHash, role: "owner", status: "active", emailVerified: new Date() },
    });
  });

  return { ok: true };
}
