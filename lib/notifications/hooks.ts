/**
 * Acquisition OS Event Hooks
 *
 * These functions are called at real state transition points in the
 * Acquisition OS lifecycle. They create notifications through the engine.
 *
 * Integration pattern:
 *   When a real event happens (e.g., batch completes, campaign deploys),
 *   call the corresponding hook. The hook checks preferences and creates
 *   notifications across enabled channels.
 *
 * IMPORTANT: These are called from server-side code only (API routes,
 * server actions, background jobs). They are NOT called from the browser.
 */

import { createMultiChannelNotification } from "./engine";
import {
  NOTIFICATION_EVENT_TYPES,
  type NotificationEventType,
  type NotificationContext,
} from "./types";

// ─── Helper: Fire and Forget ──────────────────────────────────────────

/**
 * Create notification(s) without blocking the caller.
 * Failures are logged but do not throw.
 */
function fireNotification(
  input: Parameters<typeof createMultiChannelNotification>[0],
): void {
  createMultiChannelNotification(input).catch((err) => {
    console.error("[notification-hook] Failed to create notification:", err);
  });
}

// ─── Cycle Hooks ──────────────────────────────────────────────────────

export function onCycleStarted(
  tenantId: string,
  cycleId: string,
  userId?: string,
) {
  fireNotification({
    tenantId,
    userId,
    eventType: NOTIFICATION_EVENT_TYPES.CYCLE_STARTED,
    cycleId,
    context: { cycleId },
  });
}

export function onLeadGenerationCompleted(
  tenantId: string,
  cycleId: string,
  context: NotificationContext,
  userId?: string,
) {
  fireNotification({
    tenantId,
    userId,
    eventType: NOTIFICATION_EVENT_TYPES.LEAD_GENERATION_COMPLETED,
    cycleId,
    context,
  });
}

export function onLeadReportReady(
  tenantId: string,
  cycleId: string,
  context: NotificationContext,
  userId?: string,
) {
  fireNotification({
    tenantId,
    userId,
    eventType: NOTIFICATION_EVENT_TYPES.LEAD_REPORT_READY,
    cycleId,
    context,
  });
}

export function onCycleReportReady(
  tenantId: string,
  cycleId: string,
  context: NotificationContext,
  userId?: string,
) {
  fireNotification({
    tenantId,
    userId,
    eventType: NOTIFICATION_EVENT_TYPES.CYCLE_REPORT_READY,
    cycleId,
    context,
  });
}

// ─── Campaign Hooks ───────────────────────────────────────────────────

export function onEmailsReadyForReview(
  tenantId: string,
  campaignId: string,
  cycleId: string | undefined,
  context: NotificationContext,
  userId?: string,
) {
  fireNotification({
    tenantId,
    userId,
    eventType: NOTIFICATION_EVENT_TYPES.EMAILS_READY_FOR_REVIEW,
    campaignId,
    cycleId,
    context,
  });
}

export function onCampaignDeployed(
  tenantId: string,
  campaignId: string,
  cycleId: string | undefined,
  context: NotificationContext,
  userId?: string,
) {
  fireNotification({
    tenantId,
    userId,
    eventType: NOTIFICATION_EVENT_TYPES.CAMPAIGN_DEPLOYED,
    campaignId,
    cycleId,
    context,
  });
}

export function onFollowUpReady(
  tenantId: string,
  campaignId: string,
  cycleId: string | undefined,
  context: NotificationContext,
  userId?: string,
) {
  fireNotification({
    tenantId,
    userId,
    eventType: NOTIFICATION_EVENT_TYPES.FOLLOW_UP_READY,
    campaignId,
    cycleId,
    context,
  });
}

export function onFollowUpWindowCompleted(
  tenantId: string,
  campaignId: string,
  cycleId: string | undefined,
  userId?: string,
) {
  fireNotification({
    tenantId,
    userId,
    eventType: NOTIFICATION_EVENT_TYPES.FOLLOW_UP_WINDOW_COMPLETED,
    campaignId,
    cycleId,
  });
}

export function onCampaignResultsFinalized(
  tenantId: string,
  campaignId: string,
  cycleId: string | undefined,
  context: NotificationContext,
  userId?: string,
) {
  fireNotification({
    tenantId,
    userId,
    eventType: NOTIFICATION_EVENT_TYPES.CAMPAIGN_RESULTS_FINALIZED,
    campaignId,
    cycleId,
    context,
  });
}

// ─── Response Hooks ───────────────────────────────────────────────────

export function onNewResponsesDetected(
  tenantId: string,
  campaignId: string,
  cycleId: string | undefined,
  context: NotificationContext,
  userId?: string,
) {
  fireNotification({
    tenantId,
    userId,
    eventType: NOTIFICATION_EVENT_TYPES.NEW_RESPONSES_DETECTED,
    campaignId,
    cycleId,
    context,
    deduplicationSuffix: `batch-${Date.now()}`,
  });
}

export function onPositiveResponseDetected(
  tenantId: string,
  campaignId: string,
  cycleId: string | undefined,
  context: NotificationContext,
  userId?: string,
) {
  // Deduplicate by prospect — same prospect should not trigger multiple positive notifications
  const deduplicationSuffix = context.prospectName
    ? `prospect-${context.prospectName.toLowerCase().replace(/\s+/g, "-")}`
    : undefined;

  fireNotification({
    tenantId,
    userId,
    eventType: NOTIFICATION_EVENT_TYPES.POSITIVE_RESPONSE_DETECTED,
    campaignId,
    cycleId,
    context,
    deduplicationSuffix,
  });
}

// ─── Error Hooks ──────────────────────────────────────────────────────

export function onStorageConnectionError(
  tenantId: string,
  userId?: string,
) {
  fireNotification({
    tenantId,
    userId,
    eventType: NOTIFICATION_EVENT_TYPES.STORAGE_CONNECTION_ERROR,
    deduplicationSuffix: `storage-error-${Math.floor(Date.now() / 300_000)}`, // Dedup within 5min window
  });
}

export function onEmailConnectionError(
  tenantId: string,
  userId?: string,
) {
  fireNotification({
    tenantId,
    userId,
    eventType: NOTIFICATION_EVENT_TYPES.EMAIL_CONNECTION_ERROR,
    deduplicationSuffix: `email-error-${Math.floor(Date.now() / 300_000)}`,
  });
}

export function onCampaignHalted(
  tenantId: string,
  campaignId: string,
  cycleId: string | undefined,
  userId?: string,
) {
  fireNotification({
    tenantId,
    userId,
    eventType: NOTIFICATION_EVENT_TYPES.CAMPAIGN_HALTED,
    campaignId,
    cycleId,
    deduplicationSuffix: `halted-${campaignId}`,
  });
}

// ─── Generic Hook ─────────────────────────────────────────────────────

/**
 * Fire a notification for any event type.
 * Use when the specific hook above doesn't cover the case.
 */
export function onNotificationEvent(
  tenantId: string,
  eventType: NotificationEventType,
  context: NotificationContext & {
    cycleId?: string;
    campaignId?: string;
    userId?: string;
    deduplicationSuffix?: string;
  },
) {
  const { userId, cycleId, campaignId, deduplicationSuffix, ...notifContext } =
    context;

  fireNotification({
    tenantId,
    userId,
    eventType,
    cycleId,
    campaignId,
    context: notifContext,
    deduplicationSuffix,
  });
}
