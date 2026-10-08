import { auth } from "@/lib/auth";
import { getEntitlement, hasCommercialAccess } from "@/lib/billing";
import { withTenantContext } from "@/lib/context";
import Link from "next/link";
import { Button } from "@/components/button";
import { Container, Section } from "@/components/container";
import { Reveal } from "@/components/reveal";
import { Stepper, type CycleStep } from "./stepper";

export const dynamic = "force-dynamic";

export default async function CycleHubPage() {
  const session = await auth();
  const user = session?.user;
  const tenantId = user?.tenantId as string | undefined;

  let hasAccess = false;
  if (tenantId) {
    try {
      const entitlement = await getEntitlement(tenantId);
      hasAccess = hasCommercialAccess(entitlement);
    } catch {
      hasAccess = false;
    }
  }

  if (!tenantId || !hasAccess) {
    return (
      <Container className="py-20 text-center">
        <Reveal>
          <div className="mx-auto max-w-xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Acquisition OS · Cycle</p>
            <h1 className="mt-2 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
              Lease required for cycles
            </h1>
            <p className="mt-4 text-lg leading-[1.6] text-body">
              You need an active trial or lease to run acquisition cycles.
            </p>
            <Button href="/acquisition/billing" className="mt-8 w-full sm:w-auto" size="lg">
              View lease options
            </Button>
          </div>
        </Reveal>
      </Container>
    );
  }

  const state = await withTenantContext(tenantId, async (tx: any) => {
    const brain = await tx.companyBrain.findUnique({ where: { tenantId } });
    const cycles = await tx.acquisitionCycle.findMany({
      where: { tenantId },
      orderBy: { cycleNumber: "desc" },
      take: 10,
      include: {
        goals: { orderBy: { createdAt: "asc" }, take: 1 },
        templates: { orderBy: { version: "desc" }, take: 3 },
        cycleReport: { select: { id: true, status: true } },
      },
    });
    const failedJobs = await tx.aiJob.count({ where: { tenantId, status: "FAILED" } });
    const pendingJobs = await tx.aiJob.count({ where: { tenantId, status: { in: ["PENDING", "RETRY_PENDING"] } } });
    return { brain, cycles, failedJobs, pendingJobs };
  }).catch(() => ({ brain: null, cycles: [], failedJobs: 0, pendingJobs: 0 }));

  const active = state.cycles.find((c: any) => c.status === "ACTIVE") ?? null;
  const latestClosed = state.cycles.find((c: any) => c.status === "CLOSED") ?? null;

  const steps: CycleStep[] = active
    ? [
        {
          n: "01",
          title: "Company Brain",
          href: "/acquisition/cycle/brain",
          state: state.brain ? "done" : "current",
          detail: state.brain ? `${state.brain.source} · v${state.brain.version}` : "Set up your company context",
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
          state: active.templates?.some((t: any) => t.status === "approved")
            ? "done"
            : active.goals?.length
              ? "current"
              : "todo",
          detail: active.templates?.some((t: any) => t.status === "approved")
            ? `v${active.templates.find((t: any) => t.status === "approved").version} approved`
            : "Draft and approve the message",
        },
        { n: "04", title: "Cold Mail", href: "/acquisition/cycle/send", state: "current", detail: "Review the queue and send" },
        { n: "05", title: "Responses", href: "/acquisition/cycle/responses", state: "todo", detail: "Record replies, direct handling" },
        {
          n: "06",
          title: "Cycle Report",
          href: "/acquisition/cycle/report",
          state: active.cycleReport ? "done" : "todo",
          detail: active.cycleReport ? "Report ready" : "Close the cycle to generate it",
        },
      ]
    : [];

  return (
    <Container className="py-8">
      <Reveal className="mb-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Acquisition OS · Cycle</p>
        <h1 className="mt-2 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
          {active ? `Wave Cycle ${String(active.cycleNumber).padStart(2, "0")}` : "Start your first cycle"}
        </h1>
        <p className="mt-2 text-sm text-body">
          {active
            ? "Company Brain persists across cycles. Steps 2–6 run per cycle; closing returns you to Goal."
            : "Set up your Company Brain, define a goal, and run Wave Cycle 01."}
        </p>
      </Reveal>

      {(state.failedJobs > 0 || state.pendingJobs > 0) && (
        <Reveal className="mb-6">
          <div className="rounded-lg border border-line bg-white p-4 text-sm">
            {state.failedJobs > 0 ? (
              <p className="text-error">
                {state.failedJobs} AI job{state.failedJobs === 1 ? "" : "s"} failed and needs attention.{" "}
                <Link href="/acquisition/cycle/jobs" className="underline">Review jobs</Link>
              </p>
            ) : (
              <p className="text-body">
                {state.pendingJobs} AI job{state.pendingJobs === 1 ? "" : "s"} pending or retrying.{" "}
                <Link href="/acquisition/cycle/jobs" className="underline">Review jobs</Link>
              </p>
            )}
          </div>
        </Reveal>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Reveal>
          {active ? (
            <Stepper steps={steps} cycleLabel={`Wave Cycle ${String(active.cycleNumber).padStart(2, "0")}`} />
          ) : (
            <div className="rounded-lg border border-line bg-white p-8 text-center">
              <p className="text-sm text-body">No active cycle. Start with your Company Brain, then define your first goal.</p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/acquisition/cycle/brain">
                  <Button size="lg">01 · Company Brain</Button>
                </Link>
                <Link href="/acquisition/cycle/goal">
                  <Button size="lg" variant="secondary">02 · Goal</Button>
                </Link>
              </div>
            </div>
          )}
        </Reveal>

        <Reveal delay={0.05}>
          <div className="space-y-4">
            <div className="rounded-lg border border-line bg-white p-6">
              <h2 className="font-heading text-[18px] font-semibold text-navy">History</h2>
              {state.cycles.length === 0 ? (
                <p className="mt-2 text-sm text-muted">No cycles yet. Closed cycles appear here permanently.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {state.cycles.map((c: any) => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-navy">
                        Wave Cycle {String(c.cycleNumber).padStart(2, "0")}
                      </span>
                      <span className="text-muted">{c.status === "CLOSED" ? "closed" : "active"}</span>
                    </li>
                  ))}
                </ul>
              )}
              {latestClosed ? (
                <Link href="/acquisition/cycle/report" className="mt-4 inline-block text-sm text-accent underline">
                  Latest report
                </Link>
              ) : null}
            </div>
            <div className="rounded-lg border border-line bg-white p-6">
              <h2 className="font-heading text-[18px] font-semibold text-navy">Automation</h2>
              <p className="mt-2 text-sm text-muted">AI and automation jobs for your workspace.</p>
              <Link href="/acquisition/cycle/jobs" className="mt-3 inline-block text-sm text-accent underline">
                View jobs
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </Container>
  );
}
