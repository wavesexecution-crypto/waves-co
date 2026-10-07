/**
 * Signup slug-collision retry — mocked-DB unit test (no live database).
 *
 * Regression: production Postgres reports Tenant.slug unique violations with
 * meta.target === null, so target-parsing retry logic never retried and every
 * repeated business name hard-failed signup. The fix retries ANY P2002 with
 * a fresh slug suffix. This test fails against the old target-sniffing code
 * and passes with the fix.
 */
import { describe, it, expect, vi } from "vitest";

const state = vi.hoisted(() => ({ slugs: [] as string[] }));

vi.mock("@/lib/context", () => ({
  lookupUserByEmail: vi.fn().mockResolvedValue(null),
  withTenantContext: vi.fn().mockImplementation(async (_tid: string, fn: any) =>
    fn({
      tenant: {
        create: vi.fn().mockImplementation(async (a: any) => {
          state.slugs.push(a.data.slug);
          if (state.slugs.length < 3) {
            // Simulate production: P2002 with null target on slug collision.
            throw { code: "P2002", meta: { target: null } };
          }
          return { id: "t1", ...a.data };
        }),
      },
      user: { create: vi.fn().mockResolvedValue({ id: "u1" }) },
    }),
  ),
}));

import { signupAction } from "@/lib/signup";

function form(email: string) {
  const fd = new FormData();
  fd.set("tenantName", "Smoke Alpha Co");
  fd.set("name", "Smoke");
  fd.set("email", email);
  fd.set("password", "Str0ng!Pass1");
  return fd;
}

describe("signup slug retry", () => {
  it("retries P2002-with-null-target with a fresh slug and succeeds", async () => {
    state.slugs = [];
    const res = await signupAction({ ok: false }, form("retry-null-target@example.com"));
    expect(res).toEqual({ ok: true });
    expect(state.slugs).toHaveLength(3);
    expect(state.slugs[0]).toBe("smoke-alpha-co");
    expect(new Set(state.slugs).size).toBe(3);
  });
});
