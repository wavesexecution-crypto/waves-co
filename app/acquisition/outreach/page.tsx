import { auth } from "@/lib/auth";
import { getEntitlement, hasCommercialAccess } from "@/lib/billing";
import { fetchTenantLeads, type TenantLeadRow } from "@/lib/acquisition";
import Link from "next/link";
import { Button } from "@/components/button";
import { Container } from "@/components/container";
import { Reveal } from "@/components/reveal";
import { OrderDecisionButtons, OrderSendButton, SendAllButton } from "./outreach-actions";

export const dynamic = "force-dynamic";

export default async function OutreachPage() {
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
            <h1 className="font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
              Lease required for outreach
            </h1>
            <p className="mt-4 text-lg leading-[1.6] text-body">
              You need an active lease to review and send outreach emails.
            </p>
            <Button href="/acquisition/billing" className="mt-8 w-full sm:w-auto" size="lg">
              View lease options
            </Button>
          </div>
        </Reveal>
      </Container>
    );
  }

  let ready: TenantLeadRow[] = [];
  let approved: TenantLeadRow[] = [];
  let sent: TenantLeadRow[] = [];
  let failed: TenantLeadRow[] = [];
  let loadError: string | null = null;
  try {
    const [rDrafts, rApproved, rSent, rFailed] = await Promise.all([
      fetchTenantLeads(tenantId, { statuses: ["READY_FOR_APPROVAL", "PENDING"], pageSize: 50 }),
      fetchTenantLeads(tenantId, { statuses: ["APPROVED"], pageSize: 50 }),
      fetchTenantLeads(tenantId, { statuses: ["SENT", "DELIVERED"], pageSize: 50 }),
      fetchTenantLeads(tenantId, { statuses: ["FAILED"], pageSize: 50 }),
    ]);
    ready = rDrafts.leads;
    approved = rApproved.leads;
    sent = rSent.leads;
    failed = rFailed.leads;
  } catch {
    loadError = "Could not load outreach. Please refresh to retry.";
  }

  return (
    <Container className="py-8">
      {/* Header */}
      <Reveal className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Outreach</p>
            <h1 className="mt-2 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
              Review and send emails
            </h1>
            <p className="mt-2 text-sm text-body">
              {approved.length} approved and ready to send · {ready.length} awaiting decision
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/acquisition/leads">
              <Button variant="secondary">← Leads</Button>
            </Link>
            <Link href="/acquisition/replies">
              <Button variant="secondary">Replies →</Button>
            </Link>
          </div>
        </div>
      </Reveal>

      {loadError ? (
        <div className="rounded-lg border border-line bg-white p-8 text-center">
          <p className="text-sm text-body">{loadError}</p>
        </div>
      ) : (
        <>
          {/* Ready to Send (approved, unsent) */}
          <Reveal delay={0.05} className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy">
                Ready to send ({approved.length})
              </h2>
              {approved.length > 0 && <SendAllButton orderIds={approved.map((o) => o.id)} />}
            </div>

            {approved.length === 0 ? (
              <div className="rounded-lg border border-line bg-white p-8 text-center">
                <p className="text-sm text-muted">No approved emails yet. Approve leads to queue them here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {approved.map((email) => (
                  <EmailCard key={email.id} email={email} action={<OrderSendButton orderId={email.id} />} badge="Approved" />
                ))}
              </div>
            )}
          </Reveal>

          {/* Awaiting decision */}
          <Reveal delay={0.1} className="mb-8">
            <h2 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy mb-4">
              Awaiting decision ({ready.length})
            </h2>
            {ready.length === 0 ? (
              <div className="rounded-lg border border-line bg-white p-8 text-center">
                <p className="text-sm text-muted">Nothing waiting. New prospects appear here after import.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ready.map((email) => (
                  <EmailCard key={email.id} email={email} action={<OrderDecisionButtons orderId={email.id} />} badge="Needs decision" />
                ))}
              </div>
            )}
          </Reveal>

          {/* Sent */}
          <Reveal delay={0.15} className="mb-8">
            <h2 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy mb-4">
              Sent ({sent.length})
            </h2>
            <div className="space-y-3">
              {sent.map((email) => (
                <SentEmailRow key={email.id} email={email} />
              ))}
              {sent.length === 0 && (
                <div className="rounded-lg border border-line bg-white p-8 text-center">
                  <p className="text-sm text-muted">Nothing sent yet.</p>
                </div>
              )}
            </div>
          </Reveal>

          {/* Failed */}
          {failed.length > 0 && (
            <Reveal delay={0.2}>
              <h2 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy mb-4">
                Failed ({failed.length})
              </h2>
              <div className="space-y-3">
                {failed.map((email) => (
                  <div key={email.id} className="rounded-lg border border-line bg-white p-4">
                    <p className="font-medium text-navy">{email.contactName ?? email.businessName} @ {email.businessName}</p>
                    <p className="text-sm text-muted">{email.subject}</p>
                    <p role="alert" className="mt-2 text-sm text-red-600">{email.sendError ?? "Send failed."}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          )}
        </>
      )}
    </Container>
  );
}

function EmailCard({ email, action, badge }: { email: TenantLeadRow; action: React.ReactNode; badge: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
                {email.businessName} • {email.contactRole ?? "Prospect"}
              </p>
              <h3 className="mt-1 font-medium text-navy">{email.contactName ?? email.businessName}</h3>
              <p className="text-sm text-muted">{email.email}</p>
            </div>
            <span className="px-2 py-1 rounded bg-accent/10 text-accent text-xs font-medium">{badge}</span>
          </div>

          <div className="border-t border-line pt-4">
            <p className="font-medium text-navy mb-2">Subject: {email.subject}</p>
            <div className="bg-paper/50 rounded p-4 max-h-40 overflow-y-auto text-sm text-body whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {email.body}
            </div>
          </div>
        </div>

        {action}
      </div>
    </div>
  );
}

function SentEmailRow({ email }: { email: TenantLeadRow }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-success" />
          <div>
            <p className="font-medium text-navy">{email.contactName ?? email.businessName} @ {email.businessName}</p>
            <p className="text-sm text-muted">{email.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="px-2 py-0.5 rounded bg-success/10 text-success text-xs font-medium">Sent</span>
          {email.sentAt && <span>• {new Date(email.sentAt).toLocaleDateString()}</span>}
        </div>
      </div>
    </div>
  );
}
