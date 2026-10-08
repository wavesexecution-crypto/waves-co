import { POST as webhookPOST } from "../webhook/route";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/razorpay/events — alias for the authoritative Razorpay
 * webhook (/api/billing/razorpay/webhook). Some dashboard configurations
 * point at this path; both paths run the byte-identical handler (signature
 * verification, tenant re-check, integrity, idempotent compare-and-set), so
 * whichever URL Razorpay calls behaves the same. Duplicate deliveries across
 * the two paths are still safe: activation is a compare-and-set on paymentId.
 */
export async function POST(req: Request) {
  return webhookPOST(req);
}
