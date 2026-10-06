"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/button";
import { Container, Section } from "@/components/container";
import { Reveal } from "@/components/reveal";

interface SettingsClientProps {
  user: { name?: string | null; email?: string | null; id?: string } | undefined;
  tenantId: string | undefined;
  hasAccess: boolean;
}

const ROLE_OPTIONS = ["CEO / Founder", "CTO / VP Engineering", "VP Marketing / CMO", "VP Sales / CRO", "Head of Product", "Head of Operations", "VP Finance / CFO"];
const INDUSTRY_OPTIONS = ["Technology / Software", "Financial Services", "Healthcare / Life Sciences", "Manufacturing / Industrial", "Retail / E-commerce", "Professional Services", "Other"];

export function SettingsClient({ user, tenantId, hasAccess }: SettingsClientProps) {
  if (!tenantId) {
    return (
      <Container className="py-20 text-center">
        <Reveal>
          <div className="mx-auto max-w-xl">
            <h1 className="font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
              Sign in to access settings
            </h1>
            <p className="mt-4 text-lg leading-[1.6] text-body">
              You need to be signed in to manage your Acquisition OS settings.
            </p>
            <Link href="/login?callbackUrl=/acquisition/settings">
              <Button className="mt-8 w-full sm:w-auto" size="lg">Sign in</Button>
            </Link>
          </div>
        </Reveal>
      </Container>
    );
  }

  return (
    <Container className="py-8 max-w-3xl">
      {/* Header */}
      <Reveal className="mb-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Settings</p>
            <h1 className="mt-2 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
              Acquisition OS settings
            </h1>
          </div>
          <Link href="/acquisition">
            <Button variant="secondary">← Back to Home</Button>
          </Link>
        </div>
      </Reveal>

      {/* Profile Section */}
      <Reveal delay={0.05} className="mb-8">
        <Section className="py-0">
          <h2 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy mb-6">
            Profile
          </h2>
          <div className="rounded-lg border border-line bg-white p-6 space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-navy text-2xl font-bold text-white">
                {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "W"}
              </div>
              <div>
                <p className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy">
                  {user?.name || "Your Name"}
                </p>
                <p className="text-sm text-muted">{user?.email}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-line">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted mb-3">Account</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Link href="/acquisition/billing">
                  <Button variant="secondary" className="w-full">Manage lease</Button>
                </Link>
                <Link href="/acquisition/settings/notifications">
                  <Button variant="secondary" className="w-full">Notifications</Button>
                </Link>
              </div>
            </div>
          </div>
        </Section>
      </Reveal>

      {/* Notifications Preferences */}
      <Reveal delay={0.1} className="mb-8">
        <Section className="py-0">
          <h2 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy mb-6">
            Notifications
          </h2>
          <div className="rounded-lg border border-line bg-white p-6 space-y-4">
            <NotificationToggle
              label="New leads found"
              description="Get notified when Acquisition OS discovers new prospects"
              enabled={true}
            />
            <NotificationToggle
              label="Emails ready for review"
              description="Know when new outreach emails need your approval"
              enabled={true}
            />
            <NotificationToggle
              label="Replies received"
              description="Instant notification when prospects respond"
              enabled={true}
            />
            <NotificationToggle
              label="Follow-ups due"
              description="Reminder when it's time to follow up with prospects"
              enabled={true}
            />
            <NotificationToggle
              label="Weekly report"
              description="Summary of your acquisition activity every Monday"
              enabled={false}
            />
          </div>
        </Section>
      </Reveal>

      {/* Target Customer Profile */}
      <Reveal delay={0.15} className="mb-8">
        <Section className="py-0">
          <h2 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy mb-6">
            Target customer profile
          </h2>
          <p className="text-sm text-muted mb-6">
            Update your ideal customer criteria. Changes apply to future searches.
          </p>
          <CustomerProfileForm />
        </Section>
      </Reveal>

      {/* Danger Zone */}
      <Reveal delay={0.2}>
        <Section className="py-0">
          <h2 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-error mb-6">
            Danger zone
          </h2>
          <div className="rounded-lg border border-error/20 bg-error/5 p-6">
            <p className="text-sm text-body mb-4">
              These actions are irreversible. Please be certain before proceeding.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <EraseWorkflowDataButton />
              <Button variant="destructive" className="w-full sm:w-auto" onClick={() => signOut({ callbackUrl: "/login" })}>
                Sign out everywhere
              </Button>
            </div>
          </div>
        </Section>
      </Reveal>
    </Container>
  );
}

/** Loads the stored business context, lets the customer edit ICP criteria, saves via API. */
function CustomerProfileForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [base, setBase] = useState<any>(null);
  const [companySize, setCompanySize] = useState("51-200 employees");
  const [roles, setRoles] = useState<string[]>([...ROLE_OPTIONS]);
  const [industries, setIndustries] = useState<string[]>(["Technology / Software"]);
  const [locations, setLocations] = useState("US, UK, Canada");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/acquisition/profile");
        const j = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && (j as any)?.profile) {
          const p = (j as any).profile;
          setBase(p);
          const icp = p.icp ?? {};
          if (typeof icp.companySize === "string" && icp.companySize) setCompanySize(icp.companySize);
          if (Array.isArray(icp.roles)) setRoles(icp.roles);
          if (Array.isArray(icp.industries)) setIndustries(icp.industries);
          if (typeof icp.locations === "string") setLocations(icp.locations);
        }
      } catch {
        // Keep defaults; save will surface any problem.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = (list: string[], v: string, set: (x: string[]) => void) => {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      if (!base?.companyName || !base?.industry) {
        throw new Error("Complete onboarding first so we know your company.");
      }
      const res = await fetch("/api/acquisition/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: base.companyName,
          website: base.website ?? undefined,
          industry: base.industry,
          businessModel: base.businessModel ?? undefined,
          icp: { companySize, roles, industries, locations: locations || undefined, painPoints: base?.icp?.painPoints ?? undefined },
          offer: base.offer ?? undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) throw new Error("Please sign in again.");
        const first = Array.isArray((j as any)?.issues) && (j as any).issues.length > 0 ? String((j as any).issues[0].message) : undefined;
        throw new Error(first ?? (j as any)?.error ?? "Could not save. Please retry.");
      }
      setBase((j as any).profile);
      setOk("Saved. Changes apply to future searches.");
    } catch (e: any) {
      setError(e?.message ?? "Could not save. Please retry.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-line bg-white p-6">
        <p className="text-sm text-muted">Loading your profile…</p>
      </div>
    );
  }

  if (!base) {
    return (
      <div className="rounded-lg border border-line bg-white p-6 space-y-4">
        <p className="text-sm text-body">No business context yet. Complete onboarding to set your target criteria.</p>
        <Link href="/acquisition/onboarding">
          <Button>Start onboarding</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-white p-6 space-y-6">
      <div className="space-y-3">
        <label className="block text-sm font-medium text-navy">Company size</label>
        <select value={companySize} onChange={(e) => setCompanySize(e.target.value)} className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy">
          {["1-10 employees", "11-50 employees", "51-200 employees", "201-500 employees", "501-1000 employees", "1000+ employees"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="space-y-3">
        <label className="block text-sm font-medium text-navy">Decision maker roles</label>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map((role) => (
            <label key={role} className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-line bg-white text-sm cursor-pointer hover:border-accent">
              <input type="checkbox" className="rounded border-line text-accent focus:ring-accent" checked={roles.includes(role)} onChange={() => toggle(roles, role, setRoles)} />
              <span>{role}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <label className="block text-sm font-medium text-navy">Industries</label>
        <div className="flex flex-wrap gap-2">
          {INDUSTRY_OPTIONS.map((industry) => (
            <label key={industry} className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-line bg-white text-sm cursor-pointer hover:border-accent">
              <input type="checkbox" className="rounded border-line text-accent focus:ring-accent" checked={industries.includes(industry)} onChange={() => toggle(industries, industry, setIndustries)} />
              <span>{industry}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <label className="block text-sm font-medium text-navy">Locations</label>
        <input type="text" value={locations} onChange={(e) => setLocations(e.target.value)} className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy" placeholder="US, UK, Canada" />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {ok && <p role="status" className="text-sm text-emerald-700">{ok}</p>}
      <Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save changes"}</Button>
    </div>
  );
}

/** Typed-confirmation erase of own workflow data (identity/billing untouched). */
function EraseWorkflowDataButton() {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const erase = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/acquisition/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(res.status === 401 ? "Please sign in again." : (j as any)?.error ?? "Could not erase data.");
      setDone(true);
      setConfirming(false);
    } catch (e: any) {
      setError(e?.message ?? "Could not erase data.");
    } finally {
      setPending(false);
    }
  };

  if (done) return <p role="status" className="text-sm text-body">Workflow data erased. Your account and lease are untouched.</p>;

  if (!confirming) {
    return (
      <Button variant="destructive" className="w-full sm:w-auto" onClick={() => { setConfirming(true); setError(null); }}>
        Delete all my data
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-body">Erases prospects, outreach, replies, follow-ups and reports for your workspace. Account, sign-in and billing stay.</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-3">
        <Button variant="destructive" disabled={pending} onClick={erase}>{pending ? "Erasing…" : "Yes, erase it"}</Button>
        <Button variant="secondary" onClick={() => setConfirming(false)}>Keep my data</Button>
      </div>
    </div>
  );
}

function NotificationToggle({ label, description, enabled }: { label: string; description: string; enabled: boolean }) {
  const [isEnabled, setIsEnabled] = useState(enabled);

  return (
    <div className="flex items-center justify-between py-3 border-b border-line last:border-b-0">
      <div>
        <p className="font-medium text-navy">{label}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <button
        onClick={() => setIsEnabled(!isEnabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          isEnabled ? "bg-accent" : "bg-line"
        }`}
        role="switch"
        aria-checked={isEnabled}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isEnabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

