/**
 * Razorpay webhook path parity: /api/billing/razorpay/webhook and
 * /api/billing/razorpay/events run the byte-identical handler, so whichever
 * URL the dashboard calls behaves the same (including idempotency).
 */
import { describe, it, expect, beforeEach } from "vitest";

import { POST as webhookPOST } from "@/app/api/billing/razorpay/webhook/route";
import { POST as eventsPOST } from "@/app/api/billing/razorpay/events/route";

function req(body: unknown, sig?: string) {
  return new Request("http://x/hook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sig ? { "x-razorpay-signature": sig } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
});

describe("webhook/events parity", () => {
  it("both paths reject unsigned payloads with 401", async () => {
    const body = { event: "payment.captured", payload: {} };
    const a = await webhookPOST(req(body));
    const b = await eventsPOST(req(body));
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
  });

  it("both paths reject malformed JSON with 400 after a valid signature", async () => {
    const crypto = await import("crypto");
    const bad = "not-json{{{";
    const sig = crypto.createHmac("sha256", "test-webhook-secret").update(bad, "utf8").digest("hex");
    const a = await webhookPOST(req(bad, sig));
    const b = await eventsPOST(req(bad, sig));
    expect(a.status).toBe(400);
    expect(b.status).toBe(400);
  });

  it("both paths ack unhandled events identically (no duplicate risk)", async () => {
    const crypto = await import("crypto");
    const body = JSON.stringify({ event: "subscription.cancelled", payload: {} });
    const sig = crypto.createHmac("sha256", "test-webhook-secret").update(body, "utf8").digest("hex");
    const a = await webhookPOST(req(body, sig));
    const b = await eventsPOST(req(body, sig));
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(await a.json()).toEqual(await b.json());
  });
});
