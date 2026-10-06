"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/button";
import { Container, Section } from "@/components/container";
import { Reveal } from "@/components/reveal";

interface SettingsClientProps {
  user: { name?: string | null; email?: string | null; id?: string } | undefined;
  tenantId: string | undefined;
  hasAccess: boolean;
}

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
          <div className="rounded-lg border border-line bg-white p-6 space-y-6">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-navy">Company size</label>
              <select className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy">
                <option>1-10 employees</option>
                <option>11-50 employees</option>
                <option selected>51-200 employees</option>
                <option>201-500 employees</option>
                <option>501-1000 employees</option>
                <option>1000+ employees</option>
              </select>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-navy">Decision maker roles</label>
              <div className="flex flex-wrap gap-2">
                {["CEO / Founder", "CTO / VP Engineering", "VP Marketing / CMO", "VP Sales / CRO", "Head of Product", "Head of Operations", "VP Finance / CFO"].map((role) => (
                  <label key={role} className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-line bg-white text-sm cursor-pointer hover:border-accent">
                    <input type="checkbox" className="rounded border-line text-accent focus:ring-accent" defaultChecked />
                    <span>{role}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-navy">Industries</label>
              <div className="flex flex-wrap gap-2">
                {["Technology / Software", "Financial Services", "Healthcare / Life Sciences", "Manufacturing / Industrial", "Retail / E-commerce", "Professional Services", "Other"].map((industry) => (
                  <label key={industry} className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-line bg-white text-sm cursor-pointer hover:border-accent">
                    <input type="checkbox" className="rounded border-line text-accent focus:ring-accent" defaultChecked={industry === "Technology / Software"} />
                    <span>{industry}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-navy">Locations</label>
              <input type="text" defaultValue="US, UK, Canada" className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy" placeholder="US, UK, Canada" />
            </div>
            <Button>Save changes</Button>
          </div>
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
              <Button variant="destructive" className="w-full sm:w-auto">
                Delete all my data
              </Button>
              <Button variant="destructive" className="w-full sm:w-auto" onClick={() => signOut()}>
                Sign out everywhere
              </Button>
            </div>
          </div>
        </Section>
      </Reveal>
    </Container>
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

function signOut() {
  console.log("Sign out");
  // TODO: Call signOut API
}