/**
 * Acquisition OS Notification Engine
 *
 * Creates notifications idempotently. A single milestone event produces
 * exactly one notification per intended recipient/channel, regardless of
 * worker retries, webhook retries, page refreshes, or event replays.
 *
 * Architecture:
 *   Acquisition Event → Notification Engine → Notification Preferences → Channel Delivery
 */

import { prisma } from "../db";
import {
  EVENT_TO_CATEGORY,
  NOTIFICATION_CHANNELS as CHANNELS,
  type NotificationChannel,
  type NotificationContext,
  type NotificationEventType,
} from "./types";
import {
  buildIdempotencyKey,
  resolveNotificationContent,
  resolveResourceHref,
  resolveResourceType,
} from "./pure";

// ─── Core: Create Notification ────────────────────────────────────────

export interface CreateNotificationInput {
  tenantId: string;
  userId?: string;
  eventType: NotificationEventType;
  cycleId?: string;
  campaignId?: string;
  context?: NotificationContext;
  /** Optional suffix to allow multiple distinct notifications for the same event type */
  deduplicationSuffix?: string;
  /** Override channel. Defaults to in_app */
  channel?: NotificationChannel;
  /** Additional metadata to store */
  metadata?: Record<string, unknown>;
}

export interface CreateNotificationResult {
  created: boolean;
  notificationId: string | null;
}

/**
 * Create a notification idempotently.
 *
 * Returns { created: true, notificationId } if a new notification was created,
 * or { created: false, notificationId: existingId } if a duplicate was detected.
 *
 * This is safe to call multiple times for the same logical event.
 */
export async function createNotification(
  input: CreateNotificationInput,
): Promise<CreateNotificationResult> {
  const {
    tenantId,
    userId,
    eventType,
    cycleId,
    campaignId,
    context = {},
    deduplicationSuffix,
    channel = CHANNELS.IN_APP,
    metadata,
  } = input;

  const idempotencyKey = buildIdempotencyKey(
    tenantId,
    eventType,
    cycleId,
    campaignId,
    channel,
    deduplicationSuffix,
  );

  const { title, message } = resolveNotificationContent(eventType, context);
  const resourceHref = resolveResourceHref(eventType, context);
  const resourceType = resolveResourceType(eventType);

  // Idempotent upsert: if the key exists, return existing
  try {
    const existing = await prisma.notification.findUnique({
      where: { idempotencyKey },
      select: { id: true, tenantId: true },
    });

    if (existing) {
      // The key embeds the tenant, so a cross-tenant hit is unreachable via
      // the API — but fail closed rather than hand another tenant's row out.
      if (existing.tenantId !== tenantId) {
        throw new Error("Notification idempotency conflict");
      }
      return { created: false, notificationId: existing.id };
    }

    const notification = await prisma.notification.create({
      data: {
        tenantId,
        userId: userId ?? null,
        eventType,
        title,
        message,
        cycleId: cycleId ?? null,
        campaignId: campaignId ?? null,
        resourceType: resourceType ?? null,
        resourceId: campaignId ?? cycleId ?? null,
        resourceHref: resourceHref ?? null,
        channel,
        read: false,
        delivered: channel === CHANNELS.IN_APP, // in_app is immediately "delivered"
        deliveredAt: channel === CHANNELS.IN_APP ? new Date() : null,
        idempotencyKey,
        metadata: (metadata ?? undefined) as any,
      },
      select: { id: true },
    });

    return { created: true, notificationId: notification.id };
  } catch (err: unknown) {
    // Handle unique constraint race condition
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      // Unique constraint violation = already exists
      const existing = await prisma.notification.findUnique({
        where: { idempotencyKey },
        select: { id: true, tenantId: true },
      });
      if (existing && existing.tenantId !== tenantId) {
        throw new Error("Notification idempotency conflict");
      }
      return { created: false, notificationId: existing?.id ?? null };
    }
    throw err;
  }
}

// ─── Convenience: Create for Multiple Channels ────────────────────────

/**
 * Create notifications across all enabled channels for a tenant.
 * Checks NotificationPreference to determine which channels are enabled.
 */
export async function createMultiChannelNotification(
  input: CreateNotificationInput,
): Promise<CreateNotificationResult[]> {
  const { tenantId, eventType } = input;
  const category = EVENT_TO_CATEGORY[eventType];

  // Fetch preferences for this category
  const preferences = await prisma.notificationPreference.findMany({
    where: { tenantId, category },
    select: { channel: true, enabled: true },
  });

  // Default: in_app is always enabled if no preference exists
  const enabledChannels = new Set<string>([CHANNELS.IN_APP]);

  for (const pref of preferences) {
    if (pref.enabled) {
      enabledChannels.add(pref.channel);
    } else {
      enabledChannels.delete(pref.channel);
    }
  }

  const results: CreateNotificationResult[] = [];

  for (const channel of enabledChannels) {
    const result = await createNotification({
      ...input,
      channel: channel as NotificationChannel,
    });
    results.push(result);
  }

  return results;
}

// ─── Mark as Read ─────────────────────────────────────────────────────

export async function markNotificationRead(
  tenantId: string,
  notificationId: string,
): Promise<boolean> {
  const updated = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      tenantId,
      read: false,
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });

  return updated.count > 0;
}

export async function markAllNotificationsRead(
  tenantId: string,
): Promise<number> {
  const updated = await prisma.notification.updateMany({
    where: {
      tenantId,
      read: false,
    },
    data: {
      read: true,
      readAt: new Date(),
    },
  });

  return updated.count;
}

// ─── Query Notifications ──────────────────────────────────────────────

export interface ListNotificationsOptions {
  tenantId: string;
  userId?: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
  eventType?: NotificationEventType;
}

/**
 * Pure where-clause builder for notification listing (unit-testable).
 *
 * Tenant scope is always applied. When a userId is given, tenant-wide rows
 * (userId null — created by the engine for the whole workspace) are
 * included alongside that user's rows; without this, members would silently
 * miss workspace-level notifications.
 */
export function buildNotificationWhere(options: {
  tenantId: string;
  userId?: string;
  unreadOnly?: boolean;
  eventType?: NotificationEventType;
}): Record<string, unknown> {
  const { tenantId, userId, unreadOnly = false, eventType } = options;
  const where: Record<string, unknown> = { tenantId };
  if (userId) where.OR = [{ userId }, { userId: null }];
  if (unreadOnly) where.read = false;
  if (eventType) where.eventType = eventType;
  return where;
}

export async function listNotifications(options: ListNotificationsOptions) {
  const {
    tenantId,
    userId,
    unreadOnly = false,
    limit = 50,
    offset = 0,
    eventType,
  } = options;

  const where = buildNotificationWhere({ tenantId, userId, unreadOnly, eventType });

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        eventType: true,
        title: true,
        message: true,
        cycleId: true,
        campaignId: true,
        resourceType: true,
        resourceId: true,
        resourceHref: true,
        channel: true,
        read: true,
        readAt: true,
        createdAt: true,
        metadata: true,
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { tenantId, read: false } }),
  ]);

  return { notifications, total, unreadCount };
}

// ─── Get Single Notification ──────────────────────────────────────────

export async function getNotification(
  tenantId: string,
  notificationId: string,
) {
  return prisma.notification.findFirst({
    where: { id: notificationId, tenantId },
    select: {
      id: true,
      eventType: true,
      title: true,
      message: true,
      cycleId: true,
      campaignId: true,
      resourceType: true,
      resourceId: true,
      resourceHref: true,
      channel: true,
      read: true,
      readAt: true,
      delivered: true,
      deliveredAt: true,
      createdAt: true,
      metadata: true,
    },
  });
}
