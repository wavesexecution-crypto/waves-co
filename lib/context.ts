import { prisma } from "./db";
import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  tenantId: string;
  userId?: string;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();

function sanitizeTenantId(tenantId: string): string {
  return tenantId.replace(/['\\]/g, "");
}

/**
 * Runs `fn` inside a single transaction with the tenant context set.
 * This is required because the Neon DB has Row-Level Security (RLS):
 * every query must have `SET LOCAL app.tenant_id` inside a transaction.
 */
export async function withTenantContext<T>(
  tenantId: string,
  fn: (tx: any) => Promise<T> | T,
  userId?: string,
): Promise<T> {
  const safeTenantId = sanitizeTenantId(tenantId);
  if (safeTenantId.length === 0) {
    throw new Error("withTenantContext: invalid empty tenantId");
  }

  return tenantContext.run({ tenantId: safeTenantId, userId }, () =>
    prisma.$transaction(
      async (tx: any) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${safeTenantId}'`);
        return fn(tx);
      },
      { timeout: 15_000 },
    ),
  );
}

/**
 * Finds a user by email across ALL tenants.
 * Uses the SECURITY DEFINER function lookup_user_by_email() which
 * bypasses RLS — needed for login before a tenant context exists.
 */
export async function lookupUserByEmail(email: string): Promise<{
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
  role: string;
  status: string;
} | null> {
  const rows = await prisma.$queryRaw<any[]>`SELECT * FROM public.lookup_user_by_email(${email})`;
  return rows[0] ?? null;
}
