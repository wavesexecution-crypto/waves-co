/**
 * AI job lifecycle: create (idempotent) -> claim (leased) -> execute
 * (Ollama, one attempt) -> validate -> apply (idempotent) -> settle.
 *
 * Progress model (no background workers on serverless): every mutation
 * endpoint calls processDueAiJobs() opportunistically, and clients poll
 * GET /api/acquisition/jobs which also advances due work. A crashed attempt
 * leaves PROCESSING with a stale lease, which the next claim recovers.
 */
import { randomUUID } from "crypto";
import { withTenantContext } from "./context";
import { claimJob, completeJob, failJob, jobKey, newId } from "./jobs";
import { ollamaChat, resolveOllamaConfig, OllamaNotConfiguredError } from "./ollama";
import { OPERATIONS, validateCycleNarrative, type AiOperation } from "./ai-operations";

export const AI_MAX_ATTEMPTS = 5;

export interface CreateAiJobInput {
  tenantId: string;
  cycleId?: string | null;
  operation: AiOperation;
  model?: string | null;
  inputRef: Record<string, unknown>;
  idempotencyParts?: string[];
}

/** Create a job idempotently; returns the existing row on key collision. */
export async function createAiJob(input: CreateAiJobInput): Promise<any> {
  const key = jobKey(input.tenantId, input.operation, input.idempotencyParts ?? [JSON.stringify(input.inputRef).slice(0, 500)]);
  return withTenantContext(input.tenantId, async (tx: any) => {
    const existing = await tx.aiJob.findUnique({ where: { idempotencyKey: key } });
    if (existing) return { job: existing, reused: true };
    const config = await resolveOllamaConfig(tx, input.tenantId);
    const job = await tx.aiJob.create({
      data: {
        id: newId("aijob"),
        tenantId: input.tenantId,
        cycleId: input.cycleId ?? null,
        operation: input.operation,
        model: input.model ?? config.model,
        attempt: 0,
        maxAttempts: AI_MAX_ATTEMPTS,
        idempotencyKey: key,
        inputRef: inputRefGuard(input.inputRef),
        status: "PENDING",
      },
    });
    return { job, reused: false };
  });
}

function inputRefGuard(ref: Record<string, unknown>): Record<string, unknown> {
  const s = JSON.stringify(ref ?? {});
  if (s.length > 16_384) throw new Error("AI inputRef exceeds 16KB");
  return ref ?? {};
}

/**
 * Execute one claimed attempt. The Ollama call runs OUTSIDE any database
 * transaction (three short transactions: resolve config, settle, on-error
 * settle) so a slow provider never holds a DB connection open.
 */
async function executeAttempt(tenantId: string, job: any): Promise<void> {
  const spec = OPERATIONS[job.operation as AiOperation];
  if (!spec) {
    await withTenantContext(tenantId, (tx: any) => failJob(tx, "aiJob", job, `unknown operation ${job.operation}`, AI_MAX_ATTEMPTS));
    return;
  }
  const started = Date.now();
  // Tx 1 (short): resolve provider config only.
  const resolved = await withTenantContext(tenantId, async (tx: any) => {
    const config = await resolveOllamaConfig(tx, tenantId);
    return { config, model: job.model || config.model };
  });
  // External call with NO transaction held.
  let out: any;
  try {
    const prompt = spec.buildPrompt(job.inputRef ?? {});
    const { extractJson } = await import("./ollama");
    const raw = await ollamaChat({
      system: prompt.system,
      user: prompt.user,
      format: prompt.format,
      requestId: `${job.id}:attempt${job.attempt}`,
      config: { ...resolved.config, model: resolved.model },
    });
    out = { ...raw, parsed: extractJson(raw.content) };
  } catch (e: any) {
    const msg = e?.name === "OllamaNotConfiguredError"
      ? "AI provider not configured (no API key). Job stays retryable."
      : String(e?.message ?? e).slice(0, 2000);
    await withTenantContext(tenantId, async (tx: any) => {
      await failJob(tx, "aiJob", job, msg, job.maxAttempts ?? AI_MAX_ATTEMPTS);
      await tx.aiUsageLog.create({
        data: {
          tenantId, operation: job.operation, provider: "ollama_cloud",
          model: resolved.model ?? "unknown", status: "error",
          latencyMs: Date.now() - started, error: msg.slice(0, 500),
        },
      }).catch(() => null);
    });
    return;
  }
  // Tx 2 (short): validate -> apply -> usage -> settle. The whole settle is
  // guarded: any failure here must land on the job as a retryable error,
  // never leave it silently leased (a platform-killed function is the only
  // case that escapes this, and the stale-lease claim recovers that).
  try {
    await withTenantContext(tenantId, async (tx: any) => {
      let validated: any;
      try {
        validated = job.operation === "CYCLE_ANALYSIS"
          ? validateCycleNarrative((job.inputRef as any)?.metrics, out.parsed)
          : spec.validate(out.parsed);
      } catch (ve: any) {
        const msg = `AI output failed validation: ${String(ve?.message ?? ve).slice(0, 500)}`;
        await failJob(tx, "aiJob", job, msg, job.maxAttempts ?? AI_MAX_ATTEMPTS);
        await tx.aiUsageLog.create({
          data: {
            tenantId, operation: job.operation, provider: "ollama_cloud",
            model: resolved.model, status: "error",
            latencyMs: Date.now() - started, error: msg.slice(0, 500),
          },
        }).catch(() => null);
        return;
      }
      const applied = await applyAiResult(tx, job, tenantId, validated);
      await tx.aiUsageLog.create({
        data: {
          tenantId, operation: job.operation, provider: "ollama_cloud", model: resolved.model,
          status: "ok", inputTokens: out.promptTokens, outputTokens: out.outputTokens,
          latencyMs: out.latencyMs,
        },
      }).catch(() => null);
      await completeJob(tx, "aiJob", job.id, { applied, operation: job.operation });
    });
  } catch (e: any) {
    const msg = `settle failed: ${String(e?.message ?? e).slice(0, 500)}`;
    await withTenantContext(tenantId, async (tx: any) => {
      await failJob(tx, "aiJob", job, msg, job.maxAttempts ?? AI_MAX_ATTEMPTS);
    });
  }
}

/**
 * Idempotent appliers: re-running the same job never duplicates business
 * state. Returns { applied: boolean }.
 */
export async function applyAiResult(tx: any, job: any, tenantId: string, validated: any): Promise<boolean> {
  switch (job.operation as AiOperation) {
    case "EMAIL_GENERATION": {
      const cycleId = (job.inputRef as any)?.cycleId as string | undefined;
      if (!cycleId) return false;
      const dup = await tx.messageTemplate.findFirst({ where: { tenantId, cycleId, aiJobId: job.id } });
      if (dup) return false;
      const agg = await tx.messageTemplate.aggregate({ where: { tenantId, cycleId }, _max: { version: true } });
      const version = ((agg._max?.version as number | null) ?? 0) + 1;
      // Variant labels are cosmetic: default deterministically when the
      // model omits them (subject/body stayed strict in validation).
      const variants = (Array.isArray(validated.variants) ? validated.variants : []).map((v: any, i: number) => ({
        label: (typeof v?.label === "string" && v.label.trim() ? v.label : `Variant ${String.fromCharCode(65 + i)}`).slice(0, 60),
        subject: v.subject,
        body: v.body,
      }));
      await tx.messageTemplate.create({
        data: {
          tenantId, cycleId, version,
          subject: validated.subject, opening: validated.opening ?? null,
          body: validated.body, cta: validated.cta ?? null,
          structure: null, variants,
          status: "draft", source: "ai", aiJobId: job.id,
        },
      });
      return true;
    }
    case "REPLY_CLASSIFICATION": {
      const reportId = (job.inputRef as any)?.reportId as string | undefined;
      if (!reportId) return false;
      const report = await tx.replyReport.findFirst({ where: { id: reportId, tenantId } });
      if (!report) return false;
      // Never clobber a manual edit made after this job started.
      if (report.aiJobId && report.aiJobId !== job.id) return false;
      await tx.replyReport.update({
        where: { id: report.id },
        data: {
          replyStatus: validated.replyStatus, intent: validated.intent,
          sentiment: validated.sentiment, summary: validated.summary,
          signals: validated.signals ?? [], objections: validated.objections ?? [],
          askingFor: validated.askingFor ?? null,
          recommendedAction: validated.recommendedAction ?? null,
          source: "ai", aiJobId: job.id,
        },
      });
      return true;
    }
    case "REPLY_DIRECTION": {
      const directionId = (job.inputRef as any)?.directionId as string | undefined;
      if (!directionId) return false;
      const dir = await tx.replyDirection.findFirst({ where: { id: directionId, tenantId } });
      if (!dir || (dir.draftResponse && dir.aiJobId !== job.id)) return false;
      await tx.replyDirection.update({
        where: { id: dir.id },
        data: { draftResponse: validated.draftResponse, status: "acknowledged" },
      });
      return true;
    }
    case "CYCLE_ANALYSIS": {
      const reportId = (job.inputRef as any)?.reportId as string | undefined;
      if (!reportId) return false;
      const rep = await tx.cycleReport.findFirst({ where: { id: reportId, tenantId } });
      if (!rep || rep.narrative) return false; // immutable once written
      await tx.cycleReport.update({
        where: { id: rep.id },
        data: { narrative: validated, narrativeJobId: job.id, status: "final" },
      });
      return true;
    }
    case "BRAIN_ANALYSIS": {
      const expectedVersion = (job.inputRef as any)?.expectedVersion as number | undefined;
      const brain = await tx.companyBrain.findUnique({ where: { tenantId } });
      if (!brain) return false;
      if (typeof expectedVersion === "number" && brain.version !== expectedVersion) return false; // manual edit won
      await tx.companyBrainRevision.create({
        data: { tenantId, brainId: brain.id, version: brain.version, source: brain.source, payload: brain.payload },
      });
      await tx.companyBrain.update({
        where: { tenantId },
        data: { payload: validated, version: { increment: 1 }, source: "merged", status: "active" },
      });
      return true;
    }
    case "GOAL_ANALYSIS":
      return false; // advisory only; result lives on the job
    default:
      return false;
  }
}

/**
 * Claim and execute due AI jobs for a tenant (at most `limit` per call so a
 * single request stays bounded). Returns per-job outcomes for observability.
 */
export async function processDueAiJobs(tenantId: string, limit = 3): Promise<Array<{ id: string; operation: string; outcome: string }>> {
  const outcomes: Array<{ id: string; operation: string; outcome: string }> = [];
  for (let i = 0; i < limit; i++) {
    const claimed = await withTenantContext(tenantId, (tx: any) => claimJob(tx, "aiJob", { tenantId }));
    if (!claimed) break;
    try {
      await executeAttempt(tenantId, claimed);
      outcomes.push({ id: claimed.id, operation: claimed.operation, outcome: "attempted" });
    } catch (e: any) {
      outcomes.push({ id: claimed.id, operation: claimed.operation, outcome: `error: ${String(e?.message ?? e).slice(0, 200)}` });
    }
  }
  return outcomes;
}

export function isAiConfiguredSync(): boolean {
  return !!process.env.OLLAMA_API_KEY;
}

export { OllamaNotConfiguredError };
