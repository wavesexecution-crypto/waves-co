import { auth } from "@/lib/auth";
import { getEntitlement, hasCommercialAccess } from "@/lib/billing";
import { withTenantContext } from "@/lib/context";
import { formatCycleNumber } from "@/lib/cycle";
import Link from "next/link";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { Reveal } from "@/components/reveal";
import { Stepper, type CycleStep } from "./cycle/stepper";

export const dynamic = "force-dynamic";

export default async function AcquisitionHome() {
  const session = await auth();
  const user = session?.user;
  const tenantId = user?.tenantId as string | undefined;

  let entitlement = null;
  let hasAccess = false;
  let accessLabel = "No active lease";
  let nextAction = { label: "Start 2-Day Proof", href: "/acquisition/onboarding", primary: true };

  if (tenantId) {
    try {
      entitlement = await getEntitlement(tenantId);
      hasAccess = hasCommercialAccess(entitlement);

      if (entitlement?.status === "TRIAL") {
        const trialEnd = entitlement.trialExpiresAt ? new Date(entitlement.trialExpiresAt) : null;
        if (trialEnd) {
          const diff = trialEnd.getTime() - Date.now();
          const daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
          accessLabel = `Trial: ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`;
        }
        nextAction = { label: "Lease Acquisition OS", href: "/acquisition/billing", primary: true };
      } else if (entitlement?.status === "ACTIVE") {
        const expires = entitlement.expiresAt ? new Date(entitlement.expiresAt) : null;
        if (expires) {
          const diff = expires.getTime() - Date.now();
          const daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
          accessLabel = `Active lease: ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`;
        }
        nextAction = { label: "Extend lease", href: "/acquisition/billing", primary: false };
      } else if (entitlement?.status === "TRIAL_EXPIRED") {
        accessLabel = "Trial expired";
        nextAction = { label: "Lease Acquisition OS", href: "/acquisition/billing", primary: true };
      } else if (entitlement?.status === "EXPIRED") {
        accessLabel = "Lease expired";
        nextAction = { label: "Extend lease", href: "/acquisition/billing", primary: true };
      } else {
        accessLabel = "No active lease";
        nextAction = { label: "Start 2-Day Proof", href: "/acquisition/onboarding", primary: true };
      }
    } catch {
      accessLabel = "Unable to load access";
    }
  }

  if (!tenantId || !hasAccess) {
    return (
      <Container className="py-16 sm:py-24">
        <Reveal className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Acquisition OS</p>
          <h1 className="mt-3 font-heading text-[34px] font-semibold leading-[1.15] tracking-[-0.015em] text-navy sm:text-[44px]">
            The acquisition operating system.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-[1.7] text-body">
            Company Brain → Goal → Email Design → Cold Mail → Responses → Cycle Report. Six steps, one loop, every
            cycle numbered and permanent.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <span className="font-mono text-[11px] text-muted">{accessLabel}</span>
          </div>
          <Button href={nextAction.href} className="mt-6 w-full sm:w-auto" size="lg">
            {nextAction.label}
          </Button>
        </Reveal>
      </Container>
    );
  }

  const state = await withTenantContext(tenantId, async (tx: any) => {
    const brain = await tx.companyBrain.findUnique({ where: { tenantId } });
    const cycles = await tx.acquisitionCycle.findMany({
      where: { tenantId },
      orderBy: { cycleNumber: "desc" },
      take: 12,
      include: {
        goals: { orderBy: { createdAt: "asc" }, take: 1 },
        templates: { orderBy: { version: "desc" }, take: 5 },
        cycleReport: { select: { id: true, status: true } },
      },
    });
    const failedJobs = await tx.aiJob.count({ where: { tenantId, status: "FAILED" } });
    const pendingJobs = await tx.aiJob.count({ where: { tenantId, status: { in: ["PENDING", "RETRY_PENDING"] } } });
    return { brain, cycles, failedJobs, pendingJobs };
  }).catch(() => ({ brain: null, cycles: [], failedJobs: 0, pendingJobs: 0 }));

  const active = state.cycles.find((c: any) => c.status === "ACTIVE") ?? null;
  const closed = state.cycles.filter((c: any) => c.status === "CLOSED");

  let queueCounts = { approved: 0, sent: 0, replies: 0 };
  if (active) {
    try {
      queueCounts = await withTenantContext(tenantId, async (tx: any) => {
        const [approved, sent, replies] = await Promise.all([
          tx.outreachOrder.count({ where: { tenantId, cycleId: active.id, status: "APPROVED" } }),
          tx.outreachOrder.count({ where: { tenantId, cycleId: active.id, status: { in: ["SENT", "DELIVERED"] } } }),
          tx.replyReport.count({ where: { tenantId, cycleId: active.id } }),
        ]);
        return { approved, sent, replies };
      });
    } catch {
      queueCounts = { approved: 0, sent: 0, replies: 0 };
    }
  }

  const approvedTemplate = active?.templates?.find((t: any) => t.status === "approved") ?? null;
  const steps: CycleStep[] = active
    ? [
        {
          n: "01",
          title: "Company Brain",
          href: "/acquisition/cycle/brain",
          state: state.brain ? "done" : "current",
          detail: state.brain ? `${state.brain.source} · v${state.brain.version} · persistent` : "Set up your company context",
        },
        {
          n: "02",
          title: "Goal",
          href: "/acquisition/cycle/goal",
          state: active.goals?.length ? "done" : state.brain ? "current" : "todo",
          detail: active.goals?.[0]?.title ?? "Define this cycle's target",
        },
        {
          n: "03",
          title: "Email Design",
          href: "/acquisition/cycle/email",
          state: approvedTemplate ? "done" : active.goals?.length ? "current" : "todo",
          detail: approvedTemplate ? `v${approvedTemplate.version} approved` : "Draft and approve the message",
        },
        {
          n: "04",
          title: "Cold Mail",
          href: "/acquisition/cycle/send",
          state: queueCounts.sent > 0 ? "done" : approvedTemplate ? "current" : "todo",
          detail: `${queueCounts.approved} ready · ${queueCounts.sent} sent`,
        },
        {
          n: "05",
          title: "Responses",
          href: "/acquisition/cycle/responses",
          state: queueCounts.replies > 0 ? "done" : queueCounts.sent > 0 ? "current" : "todo",
          detail: queueCounts.replies > 0 ? `${queueCounts.replies} recorded` : "Record replies, direct handling",
        },
        {
          n: "06",
          title: "Cycle Report",
          href: "/acquisition/cycle/report",
          state: active.cycleReport ? "done" : "todo",
          detail: active.cycleReport ? "Report ready" : "Close the cycle to generate it",
        },
      ]
    : [];

  const nextStepHref =
    !state.brain
      ? "/acquisition/cycle/brain"
      : !active
        ? "/acquisition/cycle/goal"
        : !active.goals?.length
          ? "/acquisition/cycle/goal"
          : !approvedTemplate
            ? "/acquisition/cycle/email"
            : queueCounts.sent === 0
              ? "/acquisition/cycle/send"
              : !active.cycleReport
                ? "/acquisition/cycle/report"
                : "/acquisition/cycle/report";

  return (
    <Container className="py-8">
      <Reveal className="mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Acquisition OS</p>
            <h1 className="mt-1 font-heading text-[28px] font-semibold tracking-[-0.015em] text-navy sm:text-[34px]">
              {active ? `Wave Cycle ${String(active.cycleNumber).padStart(2, "0")}` : "No active cycle"}
            </h1>
          </div>
          <p className="font-mono text-[11px] text-muted">{accessLabel}</p>
        </div>
        {active?.goals?.[0] ? (
          <p className="mt-1 max-w-2xl text-sm text-body">
            Goal: <span className="font-medium text-navy">{active.goals[0].title}</span>
          </p>
        ) : null}
      </Reveal>

      {(state.failedJobs > 0 || state.pendingJobs > 0) && (
        <Reveal className="mb-4">
          <p className="rounded-md border border-line bg-white px-4 py-2.5 text-[13px]">
            {state.failedJobs > 0 ? (
              <span className="text-error">
                {state.failedJobs} WAVE AI job{state.failedJobs === 1 ? "" : "s"} failed and needs attention.{" "}
              </span>
            ) : (
              <span className="text-body">{state.pendingJobs} WAVE AI job{state.pendingJobs === 1 ? "" : "s"} pending. </span>
            )}
            <Link href="/acquisition/cycle/jobs" className="underline">
              Review jobs
            </Link>
          </p>
        </Reveal>
      )}

      {active ? (
        <Reveal className="mb-6">
          <Stepper steps={steps} cycleLabel={`Wave Cycle ${String(active.cycleNumber).padStart(2, "0")} · ${active.goals?.[0]?.title ?? "goal pending"}`} />
          <div className="mt-3">
            <Button href={nextStepHref} size="lg" className="w-full sm:w-auto">
              Continue →
            </Button>
          </div>
        </Reveal>
      ) : (
        <Reveal className="mb-6">
          <div className="rounded-lg border border-line bg-white p-8 text-center">
            <p className="text-sm text-body">
              {state.brain
                ? "Company Brain is ready. Define your first goal to open Wave Cycle 01."
                : "Start with your Company Brain — intake or Obsidian import, one canonical structure."}
            </p>
            <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
              <Button href="/acquisition/cycle/brain" size="lg" variant={state.brain ? "secondary" : undefined}>
                01 · Company Brain
              </Button>
              <Button href="/acquisition/cycle/goal" size="lg" variant={state.brain ? undefined : "secondary"}>
                02 · Goal
              </Button>
            </div>
          </div>
        </Reveal>
      )}

      {closed.length > 0 ? (
        <Reveal className="mb-6">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">History — immutable</h2>
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-white">
            {closed.map((c: any) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="font-medium text-navy">Wave Cycle {String(c.cycleNumber).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{c.goals?.[0]?.title ?? "—"}</span>
                <span className="font-mono text-[11px] text-muted">closed</span>
              </li>
            ))}
          </ul>
        </Reveal>
      ) : null}

      <Reveal>
        <p className="text-[13px] text-muted">
          Supporting surfaces:{" "}
          <Link href="/acquisition/leads" className="underline">Leads</Link>
          {" · "}
          <Link href="/acquisition/outreach" className="underline">Outreach</Link>
          {" · "}
          <Link href="/acquisition/replies" className="underline">Replies</Link>
          {" · "}
          <Link href="/acquisition/results" className="underline">Results</Link>
          {" · "}
          <Link href="/acquisition/billing" className="underline">Billing</Link>
        </p>
      </Reveal>
    </Container>
  );
}
