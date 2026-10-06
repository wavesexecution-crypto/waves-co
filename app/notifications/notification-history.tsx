"use client";

/**
 * NotificationHistory — Full page notification list with filtering.
 */

import { useEffect, useState, useCallback } from "react";
import { Bell, CheckCheck, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  eventType: string;
  title: string;
  message: string;
  cycleId: string | null;
  campaignId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  resourceHref: string | null;
  channel: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const EVENT_DOT_COLORS: Record<string, string> = {
  CYCLE_STARTED: "bg-accent",
  LEAD_GENERATION_COMPLETED: "bg-success",
  LEAD_REPORT_READY: "bg-accent",
  EMAILS_READY_FOR_REVIEW: "bg-navy",
  CAMPAIGN_DEPLOYED: "bg-accent",
  NEW_RESPONSES_DETECTED: "bg-success",
  POSITIVE_RESPONSE_DETECTED: "bg-success",
  FOLLOW_UP_READY: "bg-navy",
  FOLLOW_UP_WINDOW_COMPLETED: "bg-muted",
  CAMPAIGN_RESULTS_FINALIZED: "bg-accent",
  CYCLE_REPORT_READY: "bg-accent",
  STORAGE_CONNECTION_ERROR: "bg-error",
  EMAIL_CONNECTION_ERROR: "bg-error",
  CAMPAIGN_HALTED: "bg-error",
};

export function NotificationHistory() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 30;

  const fetchNotifications = useCallback(
    async (reset = false) => {
      setLoading(true);
      try {
        const offset = reset ? 0 : notifications.length;
        const params = new URLSearchParams({
          limit: String(LIMIT),
          offset: String(offset),
        });
        if (filter === "unread") params.set("unreadOnly", "true");

        const res = await fetch(`/api/notifications?${params}`);
        if (!res.ok) return;

        const data: NotificationsResponse = await res.json();

        if (reset) {
          setNotifications(data.notifications);
        } else {
          setNotifications((prev) => [...prev, ...data.notifications]);
        }

        setTotal(data.total);
        setUnreadCount(data.unreadCount);
        setHasMore(offset + data.notifications.length < data.total);
      } catch {
        // non-critical
      } finally {
        setLoading(false);
      }
    },
    [filter, notifications.length],
  );

  useEffect(() => {
    fetchNotifications(true);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMarkRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n,
      ),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    } catch {
      // optimistic
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        read: true,
        readAt: n.readAt ?? new Date().toISOString(),
      })),
    );
    setUnreadCount(0);
    try {
      await fetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      // optimistic
    }
  }, []);

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted" />
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
              filter === "all"
                ? "bg-navy text-white"
                : "text-muted hover:bg-paper hover:text-navy",
            )}
          >
            All ({total})
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={cn(
              "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
              filter === "unread"
                ? "bg-navy text-white"
                : "text-muted hover:bg-paper hover:text-navy",
            )}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
          >
            <CheckCheck size={13} />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="space-y-1">
        {notifications.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-line bg-white py-16 text-center">
            <Bell size={32} strokeWidth={1.2} className="mb-3 text-muted/40" />
            <p className="text-sm font-medium text-muted">No notifications</p>
            <p className="mt-1 text-xs text-muted/70">
              {filter === "unread"
                ? "You're all caught up!"
                : "Notifications from your Acquisition OS will appear here."}
            </p>
          </div>
        )}

        {notifications.map((n) => {
          const dotColor = EVENT_DOT_COLORS[n.eventType] ?? "bg-muted";
          return (
            <button
              key={n.id}
              onClick={() => {
                if (!n.read) handleMarkRead(n.id);
                if (n.resourceHref) window.location.href = n.resourceHref;
              }}
              className={cn(
                "w-full rounded-lg border px-5 py-4 text-left transition-all duration-150",
                "hover:shadow-[0_2px_8px_rgba(6,20,46,0.04)]",
                n.read
                  ? "border-line/50 bg-white"
                  : "border-line bg-accent/[0.02] shadow-[0_1px_3px_rgba(6,20,46,0.03)]",
              )}
            >
              <div className="flex gap-3.5">
                <div className="mt-1.5 flex-shrink-0">
                  <div
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      dotColor,
                      n.read && "opacity-30",
                    )}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p
                      className={cn(
                        "text-sm leading-snug",
                        n.read
                          ? "font-normal text-body"
                          : "font-semibold text-navy",
                      )}
                    >
                      {n.title}
                    </p>
                    <span className="flex-shrink-0 text-[11px] text-muted/70">
                      {relativeTime(n.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    {n.message}
                  </p>
                  {n.resourceHref && (
                    <p className="mt-2 text-[11px] font-medium text-accent">
                      View details →
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {hasMore && notifications.length > 0 && (
          <button
            onClick={() => fetchNotifications(false)}
            disabled={loading}
            className="w-full rounded-lg border border-line/50 bg-white py-3 text-center text-xs font-medium text-muted transition-colors hover:bg-paper disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        )}
      </div>
    </div>
  );
}
