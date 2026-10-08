/**
 * Email sending providers for Step 4 (Cold Mail).
 *
 * Two honest paths:
 * - WAVES-operated ("waves"): the platform Resend key sends under platform
 *   rate limits. Replies land in the tenant's own inbox (no inbound capture).
 * - Client-owned ("custom"): the tenant's own Resend key, validated live on
 *   connect (domains endpoint — no email is sent to validate) and stored
 *   AES-256-GCM encrypted with the server-only AUTH_SECRET. Only label +
 *   last4 + verification state live in cleartext. Disconnect deletes the row.
 *
 * Nothing here claims delivery: callers still map provider results to
 * ACCEPTED/FAILED exactly like the direct path (see lib/email-send.ts).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export type SendProvider = "waves" | "custom";

function aesKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("EMAIL_CREDENTIAL_STORE_UNAVAILABLE: AUTH_SECRET is not set");
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptApiKey(plain: string): { cipher: string; iv: string } {
  const key = aesKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { cipher: Buffer.concat([tag, enc]).toString("base64"), iv: iv.toString("base64") };
}

export function decryptApiKey(cipherB64: string, ivB64: string): string {
  const key = aesKey();
  const raw = Buffer.from(cipherB64, "base64");
  const tag = raw.subarray(0, 16);
  const enc = raw.subarray(16);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export interface ResolvedSender {
  mode: SendProvider;
  apiKey: string | null;
  from: string;
  label: string;
  reason: string | null;
}

function senderFrom(): string {
  return process.env.SMTP_FROM ?? "WAVES <outreach@wavesco.in>";
}

/** Live-validate a Resend key WITHOUT sending (domains endpoint). */
export async function verifyResendKey(apiKey: string): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch("https://api.resend.com/domains", {
      method: "GET",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve which key sends for this tenant/cycle choice. Never throws. */
export async function resolveEmailSender(
  tx: any,
  tenantId: string,
  provider: SendProvider,
): Promise<ResolvedSender> {
  if (provider === "custom") {
    try {
      // Optional chaining: older fakes/DBs without the table fall back to
      // "not connected" instead of throwing (the send then fails honestly).
      const cred = await tx.emailCredential?.findUnique?.({ where: { tenantId } });
      if (!cred?.keyCipher || !cred?.keyIv) {
        return { mode: "custom", apiKey: null, from: senderFrom(), label: "custom", reason: "custom provider not connected" };
      }
      const apiKey = decryptApiKey(cred.keyCipher, cred.keyIv);
      return { mode: "custom", apiKey, from: senderFrom(), label: cred.label ?? "custom", reason: null };
    } catch {
      return { mode: "custom", apiKey: null, from: senderFrom(), label: "custom", reason: "stored credential unreadable — reconnect" };
    }
  }
  const apiKey = process.env.RESEND_API_KEY ?? null;
  return {
    mode: "waves",
    apiKey,
    from: senderFrom(),
    label: "WAVES operated",
    reason: apiKey ? null : "WAVES sending is not configured (no platform key)",
  };
}

/** Connect a client-owned Resend key: live-verify, encrypt, store, record. */
export async function connectCustomProvider(
  tx: any,
  tenantId: string,
  apiKey: string,
  label?: string,
): Promise<{ ok: boolean; error?: string; keyLast4?: string }> {
  const key = String(apiKey ?? "").trim();
  if (key.length < 10) return { ok: false, error: "That key looks incomplete." };
  const valid = await verifyResendKey(key);
  if (!valid) return { ok: false, error: "Resend rejected that key. Check it and try again — nothing was stored." };
  const { cipher, iv } = encryptApiKey(key);
  const keyLast4 = key.slice(-4);
  await tx.emailCredential.upsert({
    where: { tenantId },
    create: { tenantId, provider: "resend", label: (label ?? "custom").slice(0, 80), keyLast4, keyCipher: cipher, keyIv: iv, verifiedAt: new Date() },
    update: { provider: "resend", label: (label ?? "custom").slice(0, 80), keyLast4, keyCipher: cipher, keyIv: iv, verifiedAt: new Date() },
  });
  await tx.integrationStatus.upsert({
    where: { tenantId_key: { tenantId, key: "email-provider" } },
    create: { tenantId, key: "email-provider", state: "connected", detail: `custom resend ••••${keyLast4}`, lastOkAt: new Date() },
    update: { state: "connected", detail: `custom resend ••••${keyLast4}`, lastOkAt: new Date() },
  });
  return { ok: true, keyLast4 };
}

/** Disconnect: delete the credential row so nothing remains. */
export async function disconnectCustomProvider(tx: any, tenantId: string): Promise<void> {
  await tx.emailCredential.deleteMany({ where: { tenantId } });
  await tx.integrationStatus.upsert({
    where: { tenantId_key: { tenantId, key: "email-provider" } },
    create: { tenantId, key: "email-provider", state: "disconnected", detail: null },
    update: { state: "disconnected", detail: null },
  });
}
