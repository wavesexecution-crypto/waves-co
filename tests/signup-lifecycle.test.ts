/**
 * Signup / new-user lifecycle — live-DB tests (gated) + pure unit tests.
 *
 * Live tests run ONLY when TEST_LIVE_DB=1 and DATABASE_URL is set, against a
 * throwaway synthetic tenant that is deleted afterwards. They exercise the
 * REAL signupAction (no mocks) to prove the first-time-user path.
 * NEVER point at production. Synthetic data only.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const LIVE = process.env.TEST_LIVE_DB === "1" && !!process.env.DATABASE_URL;
const t = (s: string) => (LIVE ? s : `[SKIPPED] ${s}`);
const stamp = Date.now().toString(36);
const EMAIL = `waves.signup.probe.${stamp}@example.test`;
const EMAIL_B = `waves.signup.probe.b.${stamp}@example.test`;
const EMAIL_C = `waves.signup.probe.c.${stamp}@example.test`;
const BIZ = `Signup Probe ${stamp}`;

async function cleanup(email: string) {
  if (!LIVE) return;
  const { prisma } = await import("@/lib/db");
  const u = await (prisma as any).user.findFirst({ where: { email } }).catch(() => null);
  if (u) {
    await (prisma as any).user.deleteMany({ where: { email } }).catch(() => {});
    await (prisma as any).tenant.deleteMany({ where: { id: u.tenantId } }).catch(() => {});
  }
}

describe.skipIf(!LIVE)("live signup — brand-new user", () => {
  beforeAll(async () => {
    await cleanup(EMAIL);
    await cleanup(EMAIL_B);
    await cleanup(EMAIL_C);
  });
  afterAll(async () => {
    await cleanup(EMAIL);
    await cleanup(EMAIL_B);
    await cleanup(EMAIL_C);
    const { prisma } = await import("@/lib/db");
    await (prisma as any).$disconnect().catch(() => {});
  });

  it(t("new user signup succeeds and creates tenant + owner user"), async () => {
    const { signupAction } = await import("@/lib/signup");
    const fd = new FormData();
    fd.set("tenantName", BIZ);
    fd.set("name", "Probe User");
    fd.set("email", EMAIL);
    fd.set("password", "Str0ng!Pass");
    const res = await signupAction({ ok: false }, fd);
    expect(res).toEqual({ ok: true });

    const { prisma } = await import("@/lib/db");
    const user = await (prisma as any).user.findFirst({ where: { email: EMAIL } });
    expect(user).toBeTruthy();
    expect(user.role).toBe("owner");
    expect(user.status).toBe("active");
    const tenant = await (prisma as any).tenant.findUnique({ where: { id: user.tenantId } });
    expect(tenant).toBeTruthy();
    expect(tenant.name).toBe(BIZ);
  });

  it(t("duplicate signup returns a clean exists message, creates nothing"), async () => {
    const { signupAction } = await import("@/lib/signup");
    const { prisma } = await import("@/lib/db");
    const tenantsBefore = await (prisma as any).tenant.count();
    const fd = new FormData();
    fd.set("tenantName", "Another Biz");
    fd.set("email", EMAIL);
    fd.set("password", "Str0ng!Pass");
    const res = await signupAction({ ok: false }, fd);
    expect(res.ok).toBe(false);
    expect(String(res.error)).toMatch(/already exists/i);
    expect(await (prisma as any).tenant.count()).toBe(tenantsBefore);
  });

  it(t("second business with the SAME business name does not throw"), async () => {
    const { signupAction } = await import("@/lib/signup");
    const fd = new FormData();
    fd.set("tenantName", BIZ); // identical name → identical slug
    fd.set("email", EMAIL_B);
    fd.set("password", "Str0ng!Pass");
    let res: any = null;
    let threw: unknown = null;
    try {
      res = await signupAction({ ok: false }, fd);
    } catch (e) {
      threw = e;
    }
    expect(threw, "signupAction must not throw on slug collision").toBeNull();
    expect(res?.ok).toBe(true);
  });

  it(t("login lookup finds the newly created user (sign-in keeps working)"), async () => {
    const { lookupUserByEmail } = await import("@/lib/context");
    const found = await lookupUserByEmail(EMAIL);
    expect(found?.email).toBe(EMAIL);
    expect(found?.status).toBe("active");
  });

  it(t("stored credentials verify (authorize path will accept the new user)"), async () => {
    const bcrypt = (await import("bcryptjs")).default;
    const { prisma } = await import("@/lib/db");
    const user = await (prisma as any).user.findFirst({ where: { email: EMAIL } });
    expect(user?.passwordHash).toBeTruthy();
    expect(await bcrypt.compare("Str0ng!Pass", user.passwordHash)).toBe(true);
    expect(await bcrypt.compare("Wrong!Pass1", user.passwordHash)).toBe(false);
  });

  it(t("retry with the same email is idempotent: one tenant, clean message"), async () => {
    const { signupAction } = await import("@/lib/signup");
    const { prisma } = await import("@/lib/db");
    const mk = () => {
      const fd = new FormData();
      fd.set("tenantName", `Retry Biz ${stamp}`);
      fd.set("email", EMAIL_C);
      fd.set("password", "Str0ng!Pass");
      return fd;
    };
    const first = await signupAction({ ok: false }, mk());
    expect(first).toEqual({ ok: true });
    const tenants = await (prisma as any).tenant.findMany({
      where: { users: { some: { email: EMAIL_C } } },
    });
    expect(tenants).toHaveLength(1);
    const second = await signupAction({ ok: false }, mk());
    expect(second.ok).toBe(false);
    expect(String(second.error)).toMatch(/already exists/i);
    const after = await (prisma as any).tenant.findMany({
      where: { users: { some: { email: EMAIL_C } } },
    });
    expect(after).toHaveLength(1);
  });

  it(t("degenerate business name (!!!) still creates an account, never throws"), async () => {
    const { signupAction } = await import("@/lib/signup");
    const fd = new FormData();
    fd.set("tenantName", "!!!");
    fd.set("email", `waves.signup.probe.d.${stamp}@example.test`);
    fd.set("password", "Str0ng!Pass");
    let res: any = null;
    let threw: unknown = null;
    try {
      res = await signupAction({ ok: false }, fd);
    } catch (e) {
      threw = e;
    } finally {
      await cleanup(`waves.signup.probe.d.${stamp}@example.test`);
    }
    expect(threw).toBeNull();
    expect(res?.ok).toBe(true);
  });

  it(t("no returned error ever leaks database internals"), async () => {
    const { signupAction } = await import("@/lib/signup");
    const fd = new FormData();
    fd.set("tenantName", BIZ); // slug taken by first test → exercises collision path
    fd.set("email", `waves.signup.probe.e.${stamp}@example.test`);
    fd.set("password", "Str0ng!Pass");
    let res: any = null;
    try {
      res = await signupAction({ ok: false }, fd);
    } finally {
      await cleanup(`waves.signup.probe.e.${stamp}@example.test`);
    }
    expect(res?.ok).toBe(true);
    const dup = await signupAction({ ok: false }, (() => {
      const f = new FormData();
      f.set("tenantName", "x");
      f.set("email", EMAIL);
      f.set("password", "Str0ng!Pass");
      return f;
    })());
    for (const msg of [String(dup.error)]) {
      expect(msg).not.toMatch(/prisma|P2002|Unique constraint|database|SQL|tenant_/i);
    }
  });
});

describe("signup validation (no DB)", () => {
  it("rejects missing/short/weak input with clean messages, never throws", async () => {
    const { signupAction } = await import("@/lib/signup");
    const mk = (fields: Record<string, string>) => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(fields)) fd.set(k, v);
      return fd;
    };
    expect(await signupAction({ ok: false }, mk({}))).toMatchObject({ ok: false });
    expect(await signupAction({ ok: false }, mk({ tenantName: "B", email: "a@b.co", password: "short" }))).toMatchObject({
      ok: false,
      error: expect.stringMatching(/8 characters/i),
    });
    expect(await signupAction({ ok: false }, mk({ tenantName: "B", email: "a@b.co", password: "alllowercase1" }))).toMatchObject({
      ok: false,
      error: expect.stringMatching(/stronger/i),
    });
  });
});

describe("signup prerequisites — new users need nothing pre-existing", () => {
  it("signup path references no profile/entitlement/lead/order records", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "..", "lib", "signup.ts"), "utf8");
    for (const table of ["AcquisitionProfile", "AcquisitionEntitlement", "LeadResearch", "OutreachOrder", "Conversation", "Campaign"]) {
      expect(src).not.toContain(table);
    }
    // Provisioning is atomic: tenant + user inside one transaction.
    expect(src).toContain("withTenantContext");
  });
});

describe("landing header — single Sign In CTA (bug #1 guardrail)", () => {
  it("navigation contains exactly one sign-in entry point (the cyan button)", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "..", "components", "navigation.tsx"), "utf8");
    // The cyan button:
    const buttons = src.match(/<Button href="\/login">Sign in<\/Button>/g) ?? [];
    expect(buttons).toHaveLength(1);
    // No plain-text sign-in link may remain:
    expect(src).not.toMatch(/<Link href="\/login"[^>]*>\s*Sign in\s*<\/Link>/);
    // Logged-in branch unaffected (avatar, Dashboard, Sign out still present):
    expect(src).toContain("UserAvatar");
    expect(src).toContain("Sign out");
  });
});
