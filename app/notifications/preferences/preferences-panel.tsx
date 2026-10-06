"use client";

/**
 * NotificationPreferencesPanel — Category × Channel toggle grid.
 *
 * Categories: cycle_milestones, reports, campaign_activity, responses, action_required
 * Channels: in_app, email, push
 */

import { useEffect, useState, useCallback } from "react";
import { Bell, Mail, Smartphone, Save, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
  cycle_milestones: {
    label: "Cycle Milestones",
    description: "Cycle started, lead generation, deployment",
  },
  reports: {
    label: "Reports",
    description: "Lead reports, campaign results, cycle reports",
  },
  campaign_activity: {
    label: "Campaign Activity",
    description: "Emails ready, follow-ups, window completions",
  },
  responses: {
    label: "Responses",
    description: "New replies, positive responses",
  },
  action_required: {
    label: "Important Action Required",
    description: "Storage issues, email issues, campaign halts",
  },
};

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  in_app: <Bell size={14} />,
  email: <Mail size={14} />,
  push: <Smartphone size={14} />,
};

const CHANNEL_LABELS: Record<string, string> = {
  in_app: "In-App",
  email: "Email",
  push: "Push",
};

interface Preference {
  channel: string;
  enabled: boolean;
}

interface CategoryPreferences {
  category: string;
  channels: Preference[];
}

export function NotificationPreferencesPanel() {
  const [preferences, setPreferences] = useState<CategoryPreferences[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pushAvailable, setPushAvailable] = useState(false);

  // Check push availability
  useEffect(() => {
    setPushAvailable(
      typeof window !== "undefined" &&
        "Notification" in window &&
        "serviceWorker" in navigator,
    );
  }, []);

  // Fetch preferences
  useEffect(() => {
    async function fetchPrefs() {
      try {
        const res = await fetch("/api/notifications/preferences");
        if (!res.ok) return;
        const data = await res.json();
        setPreferences(data.preferences);
      } catch {
        // non-critical
      } finally {
        setLoading(false);
      }
    }
    fetchPrefs();
  }, []);

  // Toggle a specific category/channel
  const toggle = useCallback(
    (category: string, channel: string) => {
      setPreferences((prev) =>
        prev.map((cat) => {
          if (cat.category !== category) return cat;
          return {
            ...cat,
            channels: cat.channels.map((ch) =>
              ch.channel === channel ? { ...ch, enabled: !ch.enabled } : ch,
            ),
          };
        }),
      );
      setSaved(false);
    },
    [],
  );

  // Save
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const updates = preferences.flatMap((cat) =>
        cat.channels.map((ch) => ({
          category: cat.category,
          channel: ch.channel,
          enabled: ch.enabled,
        })),
      );

      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: updates }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // non-critical
    } finally {
      setSaving(false);
    }
  }, [preferences]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    );
  }

  // Ensure all channels exist for each category
  const channels = ["in_app", "email", "push"];

  return (
    <div className="space-y-6">
      {/* Channel headers */}
      <div className="rounded-lg border border-line bg-white">
        <div className="grid grid-cols-[1fr_repeat(3,80px)] border-b border-line px-5 py-3">
          <div />
          {channels.map((ch) => (
            <div
              key={ch}
              className="flex flex-col items-center gap-1 text-center"
            >
              <span
                className={cn(
                  "text-navy/50",
                  ch === "push" && !pushAvailable && "opacity-40",
                )}
              >
                {CHANNEL_ICONS[ch]}
              </span>
              <span className="text-[11px] font-medium text-navy">
                {CHANNEL_LABELS[ch]}
              </span>
              {ch === "push" && !pushAvailable && (
                <span className="text-[9px] text-muted/60">Not available</span>
              )}
            </div>
          ))}
        </div>

        {/* Category rows */}
        {preferences.map((cat, idx) => {
          const info = CATEGORY_LABELS[cat.category] ?? {
            label: cat.category,
            description: "",
          };
          return (
            <div
              key={cat.category}
              className={cn(
                "grid grid-cols-[1fr_repeat(3,80px)] items-center px-5 py-4",
                idx < preferences.length - 1 && "border-b border-line/50",
              )}
            >
              <div>
                <p className="text-sm font-medium text-navy">{info.label}</p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {info.description}
                </p>
              </div>

              {channels.map((ch) => {
                const pref = cat.channels.find((c) => c.channel === ch);
                const enabled = pref?.enabled ?? false;
                const disabled = ch === "push" && !pushAvailable;

                return (
                  <div key={ch} className="flex justify-center">
                    <button
                      onClick={() => toggle(cat.category, ch)}
                      disabled={disabled}
                      className={cn(
                        "relative h-5 w-9 rounded-full transition-colors duration-200",
                        enabled ? "bg-accent" : "bg-line",
                        disabled && "cursor-not-allowed opacity-50",
                      )}
                      role="switch"
                      aria-checked={enabled}
                      aria-label={`${info.label} — ${CHANNEL_LABELS[ch]}`}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                          enabled && "translate-x-4",
                        )}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "inline-flex items-center gap-2 rounded-sm border px-5 py-2.5 text-sm font-semibold transition-all duration-200",
            saved
              ? "border-success bg-success/10 text-success"
              : "border-accent bg-accent text-navy-dark hover:-translate-y-0.5 hover:bg-accent-hover",
            saving && "opacity-70",
          )}
        >
          {saved ? (
            <>
              <Check size={15} />
              Saved
            </>
          ) : (
            <>
              <Save size={15} />
              {saving ? "Saving..." : "Save preferences"}
            </>
          )}
        </button>

        {!pushAvailable && (
          <p className="text-xs text-muted">
            Push notifications require browser permission. They will be
            available when configured.
          </p>
        )}
      </div>

      {/* Info */}
      <div className="rounded-lg border border-line/50 bg-paper/50 px-5 py-4">
        <p className="text-xs leading-relaxed text-muted">
          <strong className="font-medium text-navy">About push notifications:</strong>{" "}
          Push delivery requires browser notification permission and a service
          worker. The system is designed to support push when the infrastructure
          is available. Currently, in-app and email notifications are fully
          operational.
        </p>
      </div>
    </div>
  );
}
