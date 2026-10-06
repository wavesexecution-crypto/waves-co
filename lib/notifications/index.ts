/**
 * Acquisition OS Notification System
 *
 * Channel-agnostic notification engine over the real Acquisition OS lifecycle.
 *
 * Architecture:
 *   REAL EVENT → REAL STATE CHANGE → NOTIFICATION ENGINE → CLIENT NOTIFICATION
 *
 * Usage:
 *   import { createNotification, NOTIFICATION_EVENT_TYPES } from '@/lib/notifications';
 *
 *   await createNotification({
 *     tenantId: '...',
 *     eventType: NOTIFICATION_EVENT_TYPES.LEAD_GENERATION_COMPLETED,
 *     cycleId: '...',
 *     context: { leadCount: 175, qualifiedCount: 24 },
 *   });
 */

export {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_CHANNELS,
  PREFERENCE_CATEGORIES,
  EVENT_TO_CATEGORY,
  EVENT_TO_RESOURCE_TYPE,
  NOTIFICATION_TEMPLATES,
  RESOURCE_TYPES,
  type NotificationEventType,
  type NotificationChannel,
  type NotificationContext,
  type NotificationTemplate,
  type PreferenceCategory,
  type ResourceType,
} from "./types";

export {
  createNotification,
  createMultiChannelNotification,
  markNotificationRead,
  markAllNotificationsRead,
  listNotifications,
  getNotification,
  type CreateNotificationInput,
  type CreateNotificationResult,
  type ListNotificationsOptions,
} from "./engine";

export {
  ensureDefaultPreferences,
  getPreferences,
  updatePreference,
  updatePreferences,
  isChannelEnabled,
  type NotificationPreferencesResult,
  type PreferenceUpdate,
} from "./preferences";

export {
  onCycleStarted,
  onLeadGenerationCompleted,
  onLeadReportReady,
  onCycleReportReady,
  onEmailsReadyForReview,
  onCampaignDeployed,
  onFollowUpReady,
  onFollowUpWindowCompleted,
  onCampaignResultsFinalized,
  onNewResponsesDetected,
  onPositiveResponseDetected,
  onStorageConnectionError,
  onEmailConnectionError,
  onCampaignHalted,
  onNotificationEvent,
} from "./hooks";

export {
  renderNotificationEmail,
  getNotificationEmailSubject,
  getNotificationActionLabel,
  type EmailNotificationData,
} from "./email-template";
