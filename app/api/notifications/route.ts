/**
 * GET /api/notifications — List notifications for the authenticated tenant
 * POST /api/notifications — Create a notification (admin/internal only)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canCreateNotification } from "@/lib/authz";
import {
  listNotifications,
  createNotification,
  NOTIFICATION_EVENT_TYPES,
  type NotificationEventType,
} from "@/lib/notifications";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);
  const unreadOnly = searchParams.get("unreadOnly") === "true";
  const eventType = searchParams.get("eventType") as NotificationEventType | null;

  // Validate eventType if provided
  if (eventType && !Object.values(NOTIFICATION_EVENT_TYPES).includes(eventType)) {
    return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
  }

  const result = await listNotifications({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    unreadOnly,
    limit,
    offset,
    eventType: eventType ?? undefined,
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only allow internal/admin creation via API
  // In production, notifications are created by the engine, not the client.
  // Members must not be able to forge system notifications for the workspace.
  if (!canCreateNotification((session.user as any).role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { eventType, cycleId, campaignId, context } = body;

  if (!eventType || !Object.values(NOTIFICATION_EVENT_TYPES).includes(eventType)) {
    return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
  }

  const result = await createNotification({
    tenantId: session.user.tenantId,
    userId: session.user.id,
    eventType: eventType as NotificationEventType,
    cycleId,
    campaignId,
    context,
  });

  return NextResponse.json(result);
}
