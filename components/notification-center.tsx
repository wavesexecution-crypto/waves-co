"use client";

/**
 * NotificationCenter — In-app notification panel.
 *
 * Bell icon in top navigation → dropdown panel with notifications.
 * Supports: unread count badge, mark as read, mark all read,
 * notification history, click-through to resources.
 *
 * Uses WavesCo design system tokens.
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────

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

// ─── Relative Time ────────────────────────────────────────────────────

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
  });
}

// ─── Event Icon Color Map ─────────────────────────────────────────────

const EVENT_STYLES: Record<string, { dot: string; bg: string }> = {
  CYCLE_STARTED: { dot: "bg-accent", bg: "bg-accent/10" },
  LEAD_GENERATION_COMPLETED: { dot: "bg-success", bg: "bg-success/10" },
  LEAD_REPORT_READY: { dot: "bg-accent", bg: "bg-accent/10" },
  EMAILS_READY_FOR_REVIEW: { dot: "bg-navy", bg: "bg-navy/10" },
  CAMPAIGN_DEPLOYED: { dot: "bg-accent", bg: "bg-accent/10" },
  NEW_RESPONSES_DETECTED: { dot: "bg-success", bg: "bg-success/10" },
  POSITIVE_RESPONSE_DETECTED: { dot: "bg-success", bg: "bg-success/10" },
  FOLLOW_UP_READY: { dot: "bg-navy", bg: "bg-navy/10" },
  FOLLOW_UP_WINDOW_COMPLETED: { dot: "bg-muted", bg: "bg-muted/10" },
  CAMPAIGN_RESULTS_FINALIZED: { dot: "bg-accent", bg: "bg-accent/10" },
  CYCLE_REPORT_READY: { dot: "bg-accent", bg: "bg-accent/10" },
  STORAGE_CONNECTION_ERROR: { dot: "bg-error", bg: "bg-error/10" },
  EMAIL_CONNECTION_ERROR: { dot: "bg-error", bg: "bg-error/10" },
  CAMPAIGN_HALTED: { dot: "bg-error", bg: "bg-error/10" },
};

// ─── Single Notification Item ─────────────────────────────────────────

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  const styles = EVENT_STYLES[notification.eventType] ?? {
    dot: "bg-muted",
    bg: "bg-muted/10",
  };

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
    if (notification.resourceHref) {
      window.location.href = notification.resourceHref;
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "w-full text-left px-4 py-3.5 transition-colors duration-150",
        "border-b border-line/50 last:border-b-0",
        "hover:bg-paper/80 focus:bg-paper/80 focus:outline-none",
        !notification.read && "bg-accent/[0.03]",
      )}
    >
      <div className="flex gap-3">
        {/* Status dot */}
        <div className="mt-1.5 flex-shrink-0">
          <div
            className={cn(
              "h-2 w-2 rounded-full",
              styles.dot,
              notification.read && "opacity-30",
            )}
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                "text-sm leading-snug",
                notification.read
                  ? "font-normal text-body"
                  : "font-semibold text-navy",
              )}
            >
              {notification.title}
            </p>
            {!notification.read && (
              <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
            )}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted line-clamp-2">
            {notification.message}
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted/70">
            {relativeTime(notification.createdAt)}
          </p>
        </div>
      </div>
    </button>
  );
}

// ─── Notification Center ──────────────────────────────────────────────

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const offsetRef = useRef(0);
  const LIMIT = 20;

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Fetch notifications
  const fetchNotifications = useCallback(
    async (reset = false) => {
      setLoading(true);
      try {
        const offset = reset ? 0 : offsetRef.current;
        const res = await fetch(
          `/api/notifications?limit=${LIMIT}&offset=${offset}`,
        );
        if (!res.ok) return;

        const data: NotificationsResponse = await res.json();

        if (reset) {
          setNotifications(data.notifications);
          offsetRef.current = data.notifications.length;
        } else {
          setNotifications((prev) => [...prev, ...data.notifications]);
          offsetRef.current += data.notifications.length;
        }

        setUnreadCount(data.unreadCount);
        setHasMore(offset + data.notifications.length < data.total);
      } catch {
        // Silently fail — notifications are non-critical
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Fetch on open
  useEffect(() => {
    if (isOpen) {
      fetchNotifications(true);
    }
  }, [isOpen, fetchNotifications]);

  // Poll for unread count (every 30s when panel is closed)
  useEffect(() => {
    if (isOpen) return;

    let active = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/notifications?limit=1&unreadOnly=true");
        if (!res.ok || !active) return;
        const data: NotificationsResponse = await res.json();
        if (active) setUnreadCount(data.unreadCount);
      } catch {
        // non-critical
      }
    };

    poll();
    const interval = setInterval(poll, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [isOpen]);

  // Mark single as read
  const handleMarkRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      } catch {
        // optimistic update already applied
      }
    },
    [],
  );

  // Mark all as read
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
      // optimistic update already applied
    }
  }, []);

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-sm",
          "text-navy/60 transition-colors duration-150",
          "hover:bg-navy/5 hover:text-navy",
          "focus-ring",
          isOpen && "bg-navy/5 text-navy",
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={isOpen}
      >
        <Bell size={18} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-navy-dark">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className={cn(
            "absolute right-0 top-full z-50 mt-2 w-[400px] max-h-[520px]",
            "rounded-lg border border-line bg-white shadow-precise",
            "flex flex-col overflow-hidden",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-navy">Notifications</h2>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/10"
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-sm text-muted transition-colors hover:bg-paper hover:text-navy"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell
                  size={28}
                  strokeWidth={1.2}
                  className="mb-3 text-muted/40"
                />
                <p className="text-sm font-medium text-muted">
                  No notifications yet
                </p>
                <p className="mt-1 text-xs text-muted/70">
                  You&apos;ll see updates about your Acquisition OS here
                </p>
              </div>
            )}

            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={handleMarkRead}
              />
            ))}

            {/* Load more */}
            {hasMore && notifications.length > 0 && (
              <button
                onClick={() => fetchNotifications(false)}
                disabled={loading}
                className="w-full border-t border-line/50 px-4 py-2.5 text-center text-xs font-medium text-muted transition-colors hover:bg-paper/80 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Load more"}
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-line px-4 py-2.5 text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                window.location.href = "/notifications";
              }}
              className="text-[11px] font-medium text-accent transition-colors hover:text-accent-hover"
            >
              View all notifications →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
