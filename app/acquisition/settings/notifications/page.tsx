"use client";

import { useState } from "react";
import { Button } from "@/components/button";
import { Container, Section } from "@/components/container";
import { Reveal } from "@/components/reveal";
import Link from "next/link";

export default function NotificationsSettingsPage() {
  const [notifications, setNotifications] = useState([
    { id: "new-leads", label: "New leads found", description: "Get notified when Acquisition OS discovers new prospects", enabled: true },
    { id: "emails-ready", label: "Emails ready for review", description: "Know when new outreach emails need your approval", enabled: true },
    { id: "replies", label: "Replies received", description: "Instant notification when prospects respond", enabled: true },
    { id: "followups", label: "Follow-ups due", description: "Reminder when it's time to follow up with prospects", enabled: true },
    { id: "weekly-report", label: "Weekly report", description: "Summary of your acquisition activity every Monday", enabled: false },
    { id: "cycle-complete", label: "Cycle complete", description: "Notification when an acquisition cycle finishes", enabled: true },
  ]);

  const [channels, setChannels] = useState({
    inApp: true,
    email: true,
    push: false,
  });

  const toggleNotification = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n))
    );
  };

  const toggleChannel = (channel: keyof typeof channels) => {
    setChannels((prev) => ({ ...prev, [channel]: !prev[channel] }));
  };

  return (
    <Container className="py-8 max-w-3xl">
      {/* Header */}
      <Reveal className="mb-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Settings</p>
            <h1 className="mt-2 font-heading text-[32px] font-semibold tracking-[-0.015em] text-navy sm:text-[40px]">
              Notification preferences
            </h1>
          </div>
          <Link href="/acquisition/settings">
            <Button variant="secondary">← Back to Settings</Button>
          </Link>
        </div>
      </Reveal>

      {/* Notification Types */}
      <Reveal delay={0.05} className="mb-12">
        <Section className="py-0">
          <h2 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy mb-6">
            What to notify me about
          </h2>
          <div className="rounded-lg border border-line bg-white p-6 space-y-4">
            {notifications.map((notification) => (
              <NotificationToggle
                key={notification.id}
                label={notification.label}
                description={notification.description}
                enabled={notification.enabled}
                onChange={(enabled) => toggleNotification(notification.id)}
              />
            ))}
          </div>
        </Section>
      </Reveal>

      {/* Channels */}
      <Reveal delay={0.1} className="mb-12">
        <Section className="py-0">
          <h2 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy mb-6">
            How to notify me
          </h2>
          <div className="rounded-lg border border-line bg-white p-6 space-y-4">
            <ChannelToggle
              label="In-app"
              description="Notifications appear in the Acquisition OS bell icon"
              enabled={channels.inApp}
              onChange={() => toggleChannel("inApp")}
              required
            />
            <ChannelToggle
              label="Email"
              description="Notifications sent to your email address"
              enabled={channels.email}
              onChange={() => toggleChannel("email")}
            />
            <ChannelToggle
              label="Push"
              description="Push notifications to your device (requires browser permission)"
              enabled={channels.push}
              onChange={() => toggleChannel("push")}
            />
          </div>
        </Section>
      </Reveal>

      {/* Quiet Hours */}
      <Reveal delay={0.15}>
        <Section className="py-0">
          <h2 className="font-heading text-[22px] font-semibold tracking-[-0.01em] text-navy mb-6">
            Quiet hours
          </h2>
          <p className="text-sm text-muted mb-6">
            Suppress notifications during specific hours (uses your local timezone)
          </p>
          <div className="rounded-lg border border-line bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-navy">Enable quiet hours</p>
                <p className="text-sm text-muted">No notifications during selected hours</p>
              </div>
              <button
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-line transition-colors"
                role="switch"
                aria-checked={false}
              >
                <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1 transition-transform" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 pt-4 border-t border-line">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-navy">Start time</label>
                <input type="time" defaultValue="22:00" className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy" />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-navy">End time</label>
                <input type="time" defaultValue="08:00" className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy focus:ring-1 focus:ring-navy" />
              </div>
            </div>
            <Button>Save quiet hours</Button>
          </div>
        </Section>
      </Reveal>
    </Container>
  );
}

function NotificationToggle({ label, description, enabled, onChange }: { label: string; description: string; enabled: boolean; onChange: (enabled: boolean) => void }) {
  const [isEnabled, setIsEnabled] = useState(enabled);

  return (
    <div className="flex items-center justify-between py-3 border-b border-line last:border-b-0">
      <div className={`flex-1 pr-4 ${isEnabled ? "" : "opacity-50"}`}>
        <p className="font-medium text-navy">{label}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <button
        onClick={() => {
          const newValue = !isEnabled;
          setIsEnabled(newValue);
          onChange(newValue);
        }}
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

function ChannelToggle({ label, description, enabled, onChange, required }: { label: string; description: string; enabled: boolean; onChange: () => void; required?: boolean }) {
  const [isEnabled, setIsEnabled] = useState(enabled);

  if (required && !enabled) {
    return (
      <div className="flex items-center justify-between py-3 border-b border-line last:border-b-0 opacity-50">
        <div>
          <p className="font-medium text-navy">{label}</p>
          <p className="text-sm text-muted">{description}</p>
        </div>
        <span className="px-2 py-1 rounded bg-navy/10 text-navy text-[10px] font-medium">Required</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-line last:border-b-0">
      <div className={`flex-1 pr-4 ${isEnabled ? "" : "opacity-50"}`}>
        <p className="font-medium text-navy">{label}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <button
        onClick={() => {
          const newValue = !isEnabled;
          setIsEnabled(newValue);
          onChange();
        }}
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