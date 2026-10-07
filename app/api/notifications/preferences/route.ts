/**
 * GET /api/notifications/preferences — Get notification preferences
 * PUT /api/notifications/preferences — Update notification preferences
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import {
  getPreferences,
  updatePreferences,
  type PreferenceUpdate,
} from "@/lib/notifications";
import {
  PREFERENCE_CATEGORIES,
  NOTIFICATION_CHANNELS,
  type PreferenceCategory,
  type NotificationChannel,
} from "@/lib/notifications/types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preferences = await withTenantContext(session.user.tenantId, () =>
    getPreferences(session.user.tenantId as string),
  );

  return NextResponse.json({ preferences });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { preferences } = body;

  if (!Array.isArray(preferences)) {
    return NextResponse.json(
      { error: "preferences must be an array" },
      { status: 400 },
    );
  }

  // Validate each update
  const validCategories = Object.values(PREFERENCE_CATEGORIES);
  const validChannels = Object.values(NOTIFICATION_CHANNELS);

  const updates: PreferenceUpdate[] = [];

  for (const pref of preferences) {
    if (
      !validCategories.includes(pref.category) ||
      !validChannels.includes(pref.channel) ||
      typeof pref.enabled !== "boolean"
    ) {
      return NextResponse.json(
        { error: `Invalid preference: ${JSON.stringify(pref)}` },
        { status: 400 },
      );
    }
    updates.push({
      category: pref.category as PreferenceCategory,
      channel: pref.channel as NotificationChannel,
      enabled: pref.enabled,
    });
  }

  await withTenantContext(session.user.tenantId, () =>
    updatePreferences(session.user.tenantId as string, updates),
  );

  return NextResponse.json({ success: true });
}
