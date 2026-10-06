import { auth } from "@/lib/auth";
import { getEntitlement, hasCommercialAccess } from "@/lib/billing";
import Link from "next/link";
import { Button } from "@/components/button";
import { Container, Section } from "@/components/container";
import { Reveal } from "@/components/reveal";

export const dynamic = "force-dynamic";

interface Email {
  id: string;
  to: { name: string; role: string; company: string; email: string };
  subject: string;
  body: string;
  status: "draft" | "ready" | "sent" | "failed";
  scheduledFor?: string;
}

const mockEmails: Email[] = [
  {
    id: "1",
    to: { name: "Sarah Chen", role: "VP Marketing", company: "Acme Corp", email: "sarah@acme.com" },
    subject: "Ideas for Acme's Q2 marketing push",
    body: `Hi Sarah,

I saw Acme just closed Series B — congratulations. Scaling marketing after a raise is a unique challenge.

Most teams in your position waste 40% of their new budget on channels that don't convert. We've helped 3 Series B companies avoid that trap this quarter alone.

Would you be open to a 15-minute call to see how we're helping similar teams?

Best,
[Your name]`,
    status: "ready",
  },
  {
    id: "2",
    to: { name: "Marcus Johnson", role: "CTO", company: "TechStart Inc", email: "marcus@techstart.io" },
    subject: "Technical debt at TechStart?",
    body: `Hi Marcus,

Your recent blog post about scaling engineering resonated. The "feature factory" trap is real.

We've built a system that automatically identifies which technical debt actually slows down shipping — vs. what just looks messy.

Curious if that's useful for TechStart right now?

Cheers,
[Your name]`,
    status: "ready",
  },
  {
    id: "3",
    to: { name: "Emily Rodriguez", role: "Head of Operations", company: "GlobalLogistics", email: "emily@globallogistics.com" },
    subject: "Q2 expansion planning",
    body: `Hi Emily,

Expanding into new markets while vendor contracts end — that's a tough timing window.

We've helped logistics companies navigate exactly this transition. The key is having your new systems ready before the old contracts expire.

Happy to share how we've done it for 2 companies in your space.

Best,
[Your name]`,
    status: "draft",
  },
  {
    id: "4",
    to: { name: "David Park", role: "VP Finance", company: "FinanceFlow", email: "david@financeflow.com" },
    subject: "Automating FinanceFlow's reconciliation",
    body: `Hi David,

Manual reconciliation eating your team's time? You're not alone.

Finance teams at your scale typically spend 15+ hours/week on this. Our customers get that down to under 2.

Worth a quick conversation?

Best,
[Your name]`,
    status: "ready",
  },
  {
    id: "5",
    to: { name: "Lisa Wang", role: "CMO", company: "EduTech Solutions", email: "lisa@edtechsolutions.com" },
    subject: "New product launch support",
    body: `Hi Lisa,

40% budget increase + new product line = massive opportunity (and risk).

We specialize in making sure the market actually hears about new launches. Our last edtech client hit 3x their pipeline target in 60 days.

Open to seeing how?

Cheers,
[Your name]`,
    status: "ready",
  },
];

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

  const readyEmails = mockEmails.filter((e) => e.status === "ready");
  const draftEmails = mockEmails.filter((e) => e.status === "draft");
  const sentEmails = mockEmails.filter((e) => e.status === "sent");

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
              {readyEmails.length} ready for your approval
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

      {/* Ready to Send */}
      <Reveal delay={0.05} className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy">
            Ready to send ({readyEmails.length})
          </h2>
          {readyEmails.length > 0 && (
            <Button size="lg" onClick={() => sendAllEmails()}>
              Send all {readyEmails.length} emails
            </Button>
          )}
        </div>

        {readyEmails.length === 0 ? (
          <div className="rounded-lg border border-line bg-white p-8 text-center">
            <p className="text-sm text-muted">No emails ready to send yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {readyEmails.map((email) => (
              <EmailCard key={email.id} email={email} />
            ))}
          </div>
        )}
      </Reveal>

      {/* Drafts */}
      <Reveal delay={0.1} className="mb-8">
        <h2 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy mb-4">
          Drafts ({draftEmails.length})
        </h2>
        <div className="space-y-3">
          {draftEmails.map((email) => (
            <DraftEmailRow key={email.id} email={email} />
          ))}
        </div>
      </Reveal>

      {/* Sent */}
      <Reveal delay={0.15}>
        <h2 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy mb-4">
          Sent ({sentEmails.length})
        </h2>
        <div className="space-y-3">
          {sentEmails.map((email) => (
            <SentEmailRow key={email.id} email={email} />
          ))}
        </div>
      </Reveal>
    </Container>
  );
}

function EmailCard({ email }: { email: Email }) {
  return (
    <div className="rounded-lg border border-line bg-white p-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">
                {email.to.company} • {email.to.role}
              </p>
              <h3 className="mt-1 font-medium text-navy">{email.to.name}</h3>
              <p className="text-sm text-muted">{email.to.email}</p>
            </div>
            <span className="px-2 py-1 rounded bg-accent/10 text-accent text-xs font-medium">Ready</span>
          </div>

          <div className="border-t border-line pt-4">
            <p className="font-medium text-navy mb-2">Subject: {email.subject}</p>
            <div className="bg-paper/50 rounded p-4 max-h-40 overflow-y-auto text-sm text-body whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {email.body}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:ml-8">
          <Button className="w-full" onClick={() => approveEmail(email.id)}>
            Approve & send
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => editEmail(email.id)}>
            Edit
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => rejectEmail(email.id)}>
            Don't send
          </Button>
        </div>
      </div>
    </div>
  );
}

function DraftEmailRow({ email }: { email: Email }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-muted" />
          <div>
            <p className="font-medium text-navy">{email.to.name} @ {email.to.company}</p>
            <p className="text-sm text-muted">{email.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => editEmail(email.id)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => deleteEmail(email.id)}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function SentEmailRow({ email }: { email: Email }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-success" />
          <div>
            <p className="font-medium text-navy">{email.to.name} @ {email.to.company}</p>
            <p className="text-sm text-muted">{email.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="px-2 py-0.5 rounded bg-success/10 text-success text-xs font-medium">Sent</span>
          {email.scheduledFor && <span>• {new Date(email.scheduledFor).toLocaleDateString()}</span>}
        </div>
      </div>
    </div>
  );
}

function approveEmail(id: string) {
  console.log("Approve email:", id);
  // TODO: Call API
}

function rejectEmail(id: string) {
  console.log("Reject email:", id);
  // TODO: Call API
}

function editEmail(id: string) {
  console.log("Edit email:", id);
  // TODO: Open editor
}

function deleteEmail(id: string) {
  console.log("Delete email:", id);
  // TODO: Call API
}

function sendAllEmails() {
  console.log("Send all emails");
  // TODO: Call API
}