import crypto from "crypto";

/**
 * Server-only Razorpay helpers.
 *
 * SECURITY CONTRACT: this module must NEVER be imported from client code.
 * - RAZORPAY_KEY_SECRET is read exclusively from process.env on the server.
 * - The secret is never returned from any exported function.
 * - Only the public key ID (RAZORPAY_KEY_ID) may be exposed to the browser,
 *   and only because Razorpay Checkout requires it to open the payment sheet.
 */

const RAZORPAY_API = "https://api.razorpay.com/v1";

export function isRazorpayConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

/** Public key ID for the client checkout SDK. Never returns the secret. */
export function getRazorpayKeyId(): string | null {
  return process.env.RAZORPAY_KEY_ID ?? null;
}

/** Basic-auth header built from env credentials. Returns null when not configured. */
export function razorpayAuthHeader(): { Authorization: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` };
}

/**
 * Verifies the Razorpay payment signature (HMAC-SHA256) exactly as the
 * checkout callback requires: `order_id|payment_id` signed with the secret.
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret?: string,
): boolean {
  const secret = keySecret ?? process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !orderId || !paymentId || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Creates a Razorpay order server-side. amountPaise is computed from the
 * locked LEASE_PRICES table — the client can never set the price.
 */
export async function createRazorpayOrder(input: {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ ok: boolean; data: any }> {
  const headers = razorpayAuthHeader();
  if (!headers) return { ok: false, data: { error: { description: "RAZORPAY_KEY_ID/SECRET missing" } } };
  const resp = await fetch(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: input.currency ?? "INR",
      receipt: input.receipt,
      notes: input.notes ?? {},
    }),
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, data };
}

/** Fetches a payment by ID from Razorpay (used to confirm capture + amount). */
export async function fetchRazorpayPayment(paymentId: string): Promise<{ ok: boolean; pay: any }> {
  const headers = razorpayAuthHeader();
  if (!headers) return { ok: false, pay: {} };
  const resp = await fetch(`${RAZORPAY_API}/payments/${paymentId}`, { headers });
  const pay = await resp.json().catch(() => ({}));
  return { ok: resp.ok, pay };
}