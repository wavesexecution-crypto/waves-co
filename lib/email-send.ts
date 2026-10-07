/**
 * Email provider boundary.
 *
 * Isolated in its own module so the send state machine (claim → deliver →
 * record) can be tested deterministically without racing a real provider SDK
 * or a dynamic import.
 *
 * Truth contract: a resolved send means the provider ACCEPTED the message.
 * That is not delivery, not an open, and not a reply. Those require a
 * provider webhook; until then nothing in the product may claim them.
 */

/** Hard ceiling so a hung provider socket cannot pin a request open. */
export const PROVIDER_TIMEOUT_MS = 15_000;

export type DeliverResult = { ok: true } | { ok: false; error: string };

export interface DeliverInput {
  apiKey: string;
  to: string;
  subject: string;
  body: string;
  from?: string;
}

export async function deliverEmail(input: DeliverInput): Promise<DeliverResult> {
  const { Resend } = await import("resend" as any);
  const resend = new Resend(input.apiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const result = await resend.emails.send(
      {
        from: input.from ?? process.env.SMTP_FROM ?? "WavesCo <noreply@wavesco.in>",
        to: [input.to],
        subject: input.subject,
        text: input.body,
      },
      { signal: controller.signal } as any,
    );

    const error = (result as any)?.error;
    if (error) return { ok: false, error: String(error.message ?? "Email provider rejected the send") };
    return { ok: true };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return { ok: false, error: "Email provider timed out" };
    }
    return { ok: false, error: String(err?.message ?? "Send failed").slice(0, 500) };
  } finally {
    clearTimeout(timer);
  }
}