"use client";

import { useState } from "react";
import { Button } from "@/components/button";
import { Container, Section } from "@/components/container";
import { Reveal } from "@/components/reveal";
import Link from "next/link";

export default function NotificationsSettingsPage() {
  // Only events the system actually produces are toggleable. Everything else
  // is shown disabled so preferences never promise what cannot happen.
  const [notifications, setNotifications] = useState([
    { id: "emails-ready", label: "Emails ready for review", description: "Know when new outreach emails need your approval", enabled: true, available: true },
    { id: "email-errors", label: "Email connection issues", description: "Know when sending fails so you can retry", enabled: true, available: true },
    { id: "new-leads", label: "New leads found", description: "Not available yet — prospect discovery is manual", enabled: false, available: false },
    { id: "replies", label: "Replies received", description: "Not available yet — inbound capture is not connected", enabled: false, available: false },
    { id: "followups", label: "Follow-ups due", description: "Not available yet — follow-ups do not send automatically", enabled: false, available: false },
    { id: "weekly-report", label: "Weekly report", description: "Not available yet", enabled: false, available: false },
    { id: "cycle-complete", label: "Cycle complete", description: "Not available yet", enabled: false, available: false },
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
                disabled={!notification.available}
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
            <div className="flex items-center justify-between py-3 border-b border-line last:border-b-0 opacity-50">
              <div>
                <p className="font-medium text-navy">Email</p>
                <p className="text-sm text-muted">Not sent today — notifications are in-app only for now</p>
              </div>
              <span className="px-2 py-1 rounded bg-navy/10 text-navy text-[10px] font-medium">Unavailable</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-line last:border-b-0 opacity-50">
              <div>
                <p className="font-medium text-navy">Push</p>
                <p className="text-sm text-muted">Not available yet</p>
              </div>
              <span className="px-2 py-1 rounded bg-navy/10 text-navy text-[10px] font-medium">Unavailable</span>
            </div>
          </div>
        </Section>
      </Reveal>
    </Container>
  );
}

function NotificationToggle({ label, description, enabled, disabled, onChange }: { label: string; description: string; enabled: boolean; disabled?: boolean; onChange: (enabled: boolean) => void }) {
  const [isEnabled, setIsEnabled] = useState(enabled);

  if (disabled) {
    return (
      <div className="flex items-center justify-between py-3 border-b border-line last:border-b-0 opacity-50">
        <div className="flex-1 pr-4">
          <p className="font-medium text-navy">{label}</p>
          <p className="text-sm text-muted">{description}</p>
        </div>
        <span className="px-2 py-1 rounded bg-navy/10 text-navy text-[10px] font-medium">Unavailable</span>
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