/**
 * POST /api/notifications/read-all — Mark all notifications as read
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markAllNotificationsRead } from "@/lib/notifications";

export async function POST(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await markAllNotificationsRead(session.user.tenantId);

  return NextResponse.json({ success: true, markedCount: count });
}
