/**
 * app.wavesco.in/ serves the Control Center dashboard directly (rewritten to
 * /acquisition, URL unchanged). Every other host keeps the marketing home.
 */
import { describe, it, expect } from "vitest";
import { isAppHost } from "../middleware";

describe("isAppHost", () => {
  it("matches the app host only", () => {
    expect(isAppHost("app.wavesco.in")).toBe(true);
    expect(isAppHost("app.wavesco.in:443")).toBe(true);
    expect(isAppHost("APP.WAVESCO.IN")).toBe(true);
    expect(isAppHost("wavesco.in")).toBe(false);
    expect(isAppHost("www.wavesco.in")).toBe(false);
    expect(isAppHost("localhost:3000")).toBe(false);
    expect(isAppHost("localhost")).toBe(false);
    expect(isAppHost("waves-co-1.vercel.app")).toBe(false);
    expect(isAppHost("evilapp.wavesco.in.evil.com")).toBe(false);
    expect(isAppHost("")).toBe(false);
  });
});
