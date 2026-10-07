/**
 * Rate limiting on abuse-sensitive surfaces.
 *
 * The free 2-day proof is the most attractive abuse target, so trial claiming,
 * signup, login, reset and payment probing all carry a limit.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  RATE_LIMITS,
  __resetRateLimits,
  clientIpFromHeaders,
  consumeRateLimit,
  peekRateLimit,
} from "@/lib/rate-limit";

beforeEach(() => {
  __resetRateLimits();
});

describe("consumeRateLimit", () => {
  it("allows requests up to the limit and then blocks", () => {
    const limit = RATE_LIMITS.trialStart.limit;
    for (let i = 0; i < limit; i++) {
      expect(consumeRateLimit("ip-1", "trialStart").allowed).toBe(true);
    }
    const blocked = consumeRateLimit("ip-1", "trialStart");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keys are independent per identity AND per surface", () => {
    for (let i = 0; i < RATE_LIMITS.trialStart.limit; i++) consumeRateLimit("ip-1", "trialStart");
    expect(consumeRateLimit("ip-1", "trialStart").allowed).toBe(false);
    // Different client keeps working
    expect(consumeRateLimit("ip-2", "trialStart").allowed).toBe(true);
    // Same client on a different surface keeps working
    expect(consumeRateLimit("ip-1", "login").allowed).toBe(true);
  });

  it("does not let one surface starve another", () => {
    for (let i = 0; i < RATE_LIMITS.signup.limit; i++) consumeRateLimit("ip-1", "signup");
    expect(consumeRateLimit("ip-1", "signup").allowed).toBe(false);
    expect(consumeRateLimit("ip-1", "passwordReset").allowed).toBe(true);
    expect(consumeRateLimit("ip-1", "billing").allowed).toBe(true);
  });

  it("tracks usage so tests can assert without consuming", () => {
    expect(peekRateLimit("ip-1", "login")).toBe(0);
    consumeRateLimit("ip-1", "login");
    consumeRateLimit("ip-1", "login");
    expect(peekRateLimit("ip-1", "login")).toBe(2);
  });

  it("every protected surface has a real limit", () => {
    for (const [name, cfg] of Object.entries(RATE_LIMITS)) {
      expect(cfg.limit, `${name} limit`).toBeGreaterThan(0);
      expect(cfg.windowSeconds, `${name} window`).toBeGreaterThan(0);
    }
  });
});

describe("clientIpFromHeaders", () => {
  it("prefers the first entry of a forwarded chain", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    expect(clientIpFromHeaders(h)).toBe("203.0.113.9");
  });

  it("falls back through cf-connecting-ip and x-real-ip", () => {
    expect(clientIpFromHeaders(new Headers({ "cf-connecting-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "198.51.100.8" }))).toBe("198.51.100.8");
  });

  it("returns 'unknown' rather than throwing when absent", () => {
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });
});