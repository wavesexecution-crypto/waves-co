import crypto from "crypto";

/**
 * Server-only Razorpay webhook verification.
 *
 * Razorpay signs the RAW request body with the webhook secret and sends the
 * digest in `x-razorpay-signature`. Verifying against the raw body is what
 * makes this tamper-proof: re-serialising parsed JSON would change key order or
 * whitespace and break the digest.
 *
 * The webhook secret is distinct from the API key secret and must never be
 * returned to a client.
 */

export function isWebhookConfigured(): boolean {
  return !!process.env.RAZORPAY_WEBHOOK_SECRET;
}

/**
 * Constant-time HMAC-SHA256 comparison of the raw body against the header.
 * Returns false (never throws) when unconfigured or malformed.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Payment states Razorpay reports on a payment entity. */
export type RazorpayPaymentStatus = "created" | "authorized" | "captured" | "failed" | "refunded";

export interface RazorpayWebhookPaymentEntity {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
  status?: string;
  method?: string;
  error_code?: string;
  error_description?: string;
  email?: string;
}

export interface RazorpayWebhookEvent {
  event?: string;
  payload?: {
    payment?: {
      entity?: RazorpayWebhookPaymentEntity;
    };
    order?: {
      entity?: {
        id?: string;
        amount?: number;
        currency?: string;
        notes?: Record<string, string>;
        receipt?: string;
      };
    };
    refund?: {
      entity?: {
        id?: string;
        payment_id?: string;
        amount?: number;
        status?: string;
      };
    };
  };
}

/** Only payment lifecycle events that can change access are handled. */
export const HANDLED_EVENTS = ["payment.captured", "payment.failed", "refund.processed"] as const;

export function isHandledEvent(event: string): boolean {
  return (HANDLED_EVENTS as readonly string[]).includes(event);
}

export interface PaymentFacts {
  paymentId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  status: RazorpayPaymentStatus;
  errorDescription?: string;
}

/**
 * Flatten the webhook envelope into the fields activation needs. Returns null
 * when the event is unhandled or malformed — the caller then acknowledges
 * without touching entitlement state.
 */
export function extractPaymentFacts(event: RazorpayWebhookEvent): PaymentFacts | null {
  if (!event?.event) return null;
  const payment = event.payload?.payment?.entity;
  if (!payment || !payment.id || !payment.order_id) return null;

  const status = payment.status as RazorpayPaymentStatus | undefined;
  if (!status) return null;

  return {
    paymentId: String(payment.id),
    orderId: String(payment.order_id),
    amountPaise: Number(payment.amount ?? 0),
    currency: String(payment.currency ?? ""),
    status,
    errorDescription: payment.error_description ?? payment.error_code ?? undefined,
  };
}