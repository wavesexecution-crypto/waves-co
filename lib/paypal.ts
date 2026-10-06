import crypto from "crypto";

/**
 * Server-only PayPal helpers.
 *
 * SECURITY CONTRACT: this module must NEVER be imported from client code.
 * - PAYPAL_CLIENT_SECRET is read exclusively from process.env on the server.
 * - The secret is never returned from any exported function.
 * - Only the public client ID (PAYPAL_CLIENT_ID) may be exposed to the browser,
 *   and only because PayPal JS SDK requires it to render the checkout.
 */

const PAYPAL_API_BASE = process.env.PAYPAL_ENV === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

export function isPayPalConfigured(): boolean {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

/** Public client ID for the client checkout SDK. Never returns the secret. */
export function getPayPalClientId(): string | null {
  return process.env.PAYPAL_CLIENT_ID ?? null;
}

/** Bearer token header built from env credentials. Returns null when not configured. */
async function getPayPalAccessToken(): Promise<string | null> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const resp = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!resp.ok) return null;
  const data = await resp.json().catch(() => ({}));
  return data.access_token ?? null;
}

async function paypalFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getPayPalAccessToken();
  if (!token) throw new Error("PayPal not configured");

  return fetch(`${PAYPAL_API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

/**
 * Creates a PayPal order server-side. amountPaise is computed from the
 * locked LEASE_PRICES table — the client can never set the price.
 */
export async function createPayPalOrder(input: {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ ok: boolean; data: any }> {
  if (!isPayPalConfigured()) {
    return { ok: false, data: { error: { description: "PAYPAL_CLIENT_ID/SECRET missing" } } };
  }

  const amountRupees = (input.amountPaise / 100).toFixed(2);
  const resp = await paypalFetch("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        amount: {
          currency_code: input.currency ?? "INR",
          value: amountRupees,
        },
        reference_id: input.receipt,
        custom_id: JSON.stringify(input.notes ?? {}),
      }],
    }),
  });

  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, data };
}

/**
 * Captures a PayPal order server-side. Returns the captured order details.
 */
export async function capturePayPalOrder(orderId: string): Promise<{ ok: boolean; data: any }> {
  if (!isPayPalConfigured()) {
    return { ok: false, data: { error: { description: "PAYPAL_CLIENT_ID/SECRET missing" } } };
  }

  const resp = await paypalFetch(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
  });

  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, data };
}

/**
 * Fetches an order by ID from PayPal (used to confirm status + amount).
 */
export async function fetchPayPalOrder(orderId: string): Promise<{ ok: boolean; order: any }> {
  if (!isPayPalConfigured()) {
    return { ok: false, order: {} };
  }

  const resp = await paypalFetch(`/v2/checkout/orders/${orderId}`);
  const order = await resp.json().catch(() => ({}));
  return { ok: resp.ok, order };
}

/**
 * Verifies the captured PayPal order:
 * - status is COMPLETED
 * - amount matches expected
 * - currency matches expected
 * - custom_id/notes contain our tenant/lease info
 */
export function verifyPayPalCapture(
  capturedOrder: any,
  expectedAmountPaise: number,
  expectedCurrency: string,
  expectedNotes?: Record<string, string>
): { ok: boolean; error?: string } {
  if (!capturedOrder || capturedOrder.status !== "COMPLETED") {
    return { ok: false, error: "Order not completed" };
  }

  const purchaseUnits = capturedOrder.purchase_units;
  if (!purchaseUnits || purchaseUnits.length === 0) {
    return { ok: false, error: "No purchase units found" };
  }

  const pu = purchaseUnits[0];
  const captures = pu.payments?.captures;
  if (!captures || captures.length === 0) {
    return { ok: false, error: "No captures found" };
  }

  const capture = captures[0];
  if (capture.status !== "COMPLETED") {
    return { ok: false, error: "Capture not completed" };
  }

  // Verify amount (convert to paise for comparison)
  const capturedAmount = Math.round(parseFloat(capture.amount.value) * 100);
  if (capturedAmount !== expectedAmountPaise) {
    return { ok: false, error: "Amount mismatch" };
  }

  if (capture.amount.currency_code !== expectedCurrency) {
    return { ok: false, error: "Currency mismatch" };
  }

  // Verify custom_id/notes if provided
  if (expectedNotes) {
    const customId = pu.custom_id;
    if (customId) {
      try {
        const notes = JSON.parse(customId);
        for (const [key, value] of Object.entries(expectedNotes)) {
          if (notes[key] !== value) {
            return { ok: false, error: `Note mismatch: ${key}` };
          }
        }
      } catch {
        // Ignore parse errors, treat as mismatch
        return { ok: false, error: "Note parse error" };
      }
    }
  }

  return { ok: true };
}

export function getPayPalEnv(): "live" | "sandbox" {
  return process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
}