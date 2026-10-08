/**
 * Ollama Cloud transport client (https://ollama.com/api/chat, Bearer key).
 *
 * This module is transport ONLY: timeout, request identity, response shape
 * extraction, size limits. Prompt construction, untrusted-data fencing and
 * output-schema validation live in lib/ai-operations.ts; persistence, retry
 * budgets and idempotency live in lib/ai-jobs.ts (every call below runs
 * inside exactly one job attempt).
 *
 * When no credential is configured the client throws a typed NOT_CONFIGURED
 * error so jobs stay retryable/visible instead of failing silently.
 */
export interface OllamaConfig {
  baseUrl: string;
  model: string;
  apiKey: string | null;
  timeoutMs: number;
}

export class OllamaNotConfiguredError extends Error {
  constructor() {
    super("OLLAMA_NOT_CONFIGURED: no API key (env OLLAMA_API_KEY or tenant credentialRef) and no local server configured");
    this.name = "OllamaNotConfiguredError";
  }
}

export class OllamaResponseError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(`OLLAMA_HTTP_${status}: ${detail.slice(0, 300)}`);
    this.name = "OllamaResponseError";
    this.status = status;
  }
}

export class OllamaOversizeError extends Error {
  constructor(chars: number, max: number) {
    super(`OLLAMA_OVERSIZE: ${chars} chars exceeds ${max} char limit`);
    this.name = "OllamaOversizeError";
  }
}

const DEFAULT_BASE_URL = "https://ollama.com/api";
const DEFAULT_MODEL = "gpt-oss:120b-cloud";
const DEFAULT_TIMEOUT_MS = 60_000;
export const MAX_OUTPUT_CHARS = 24_000;

/**
 * Resolve effective config: per-tenant ClientAiConfig row wins, otherwise
 * platform env, otherwise documented cloud defaults (key still required).
 * credentialRef format is "env:VAR_NAME" (see schema comment); secrets are
 * never read from the database, only referenced.
 */
export async function resolveOllamaConfig(
  tx: any,
  tenantId: string,
): Promise<OllamaConfig> {
  let row: any = null;
  try {
    row = await tx.clientAiConfig.findUnique({ where: { tenantId } });
  } catch {
    row = null;
  }
  const ref = typeof row?.credentialRef === "string" ? row.credentialRef : null;
  const refKey = ref && ref.startsWith("env:") ? ref.slice(4) : null;
  const apiKey =
    (refKey ? process.env[refKey] : null) ??
    process.env.OLLAMA_API_KEY ??
    null;
  return {
    baseUrl: (row?.baseUrl || process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
    model: row?.model || process.env.OLLAMA_MODEL || DEFAULT_MODEL,
    apiKey,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

export interface OllamaChatInput {
  system: string;
  user: string;
  /** Optional JSON-schema-ish `format` passed to Ollama structured outputs. */
  format?: Record<string, unknown>;
  temperature?: number;
  requestId: string;
  config: OllamaConfig;
  maxChars?: number;
}

export interface OllamaChatResult {
  content: string;
  model: string;
  latencyMs: number;
  promptTokens: number | null;
  outputTokens: number | null;
}

/** Extract fenced-or-bare JSON from model text (validation happens upstream). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  return JSON.parse(raw);
}

export async function ollamaChat(input: OllamaChatInput): Promise<OllamaChatResult> {
  const { config } = input;
  if (!config.apiKey && config.baseUrl.includes("ollama.com")) {
    throw new OllamaNotConfiguredError();
  }
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), config.timeoutMs);
  // Belt and suspenders: race the fetch against our own timeout so even a
  // transport that ignores AbortSignal cannot hang the job attempt forever.
  const timeoutRace = new Promise<never>((_, reject) => {
    const t = setTimeout(() => reject(new OllamaResponseError(408, `request timeout after ${config.timeoutMs}ms`)), config.timeoutMs + 250);
    (timer as any).unref?.();
    (t as any).unref?.();
  });
  try {
    const res = await Promise.race([
      fetch(`${config.baseUrl}/api/chat`, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
          "X-Request-Id": input.requestId,
        },
        body: JSON.stringify({
          model: config.model,
          stream: false,
          ...(input.format ? { format: input.format } : {}),
          options: { temperature: input.temperature ?? 0.2 },
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: input.user },
          ],
        }),
      }),
      timeoutRace,
    ]);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new OllamaResponseError(res.status, text);
    }
    const body: any = await res.json().catch(() => null);
    const content = body?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new OllamaResponseError(res.status, "empty message.content");
    }
    const max = input.maxChars ?? MAX_OUTPUT_CHARS;
    if (content.length > max) throw new OllamaOversizeError(content.length, max);
    return {
      content,
      model: body?.model ?? config.model,
      latencyMs: Date.now() - started,
      promptTokens: typeof body?.prompt_eval_count === "number" ? body.prompt_eval_count : null,
      outputTokens: typeof body?.eval_count === "number" ? body.eval_count : null,
    };
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new OllamaResponseError(408, `request timeout after ${config.timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
