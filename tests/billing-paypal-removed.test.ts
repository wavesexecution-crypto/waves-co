/**
 * PayPal must NOT be reachable as a payment path.
 *
 * PayPal was scaffolded but never completed: it had no UI, no configured
 * credentials, and its capture route verified an uncaptured order before
 * capturing it, so the happy path could never succeed. Leaving it exposed
 * would advertise a second payment method that can only fail (or, worse, be
 * made to fail after money moved).
 *
 * This test is the regression guard for removing it: it asserts the route,
 * the client library and any PayPal environment references are gone, so a
 * future change cannot silently re-expose a broken checkout.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

describe("PayPal is disabled (single-gateway product)", () => {
  it("no PayPal API route is exposed", () => {
    expect(existsSync(join(root, "app/api/billing/paypal"))).toBe(false);
    expect(existsSync(join(root, "app/api/billing/paypal/create/route.ts"))).toBe(false);
    expect(existsSync(join(root, "app/api/billing/paypal/capture/route.ts"))).toBe(false);
  });

  it("no PayPal server library remains", () => {
    expect(existsSync(join(root, "lib/paypal.ts"))).toBe(false);
  });

  it("no application source references PayPal or its credentials", () => {
    const files = [...walk(join(root, "app")), ...walk(join(root, "lib")), ...walk(join(root, "components"))];
    const offenders = files.filter((f) => /PAYPAL_|paypal/i.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("Razorpay remains the only checkout surface wired to the UI", () => {
    const checkout = readFileSync(join(root, "components/checkout-button.tsx"), "utf8");
    expect(checkout).toContain("/api/billing/orders");
    expect(checkout).not.toMatch(/paypal/i);
  });
});