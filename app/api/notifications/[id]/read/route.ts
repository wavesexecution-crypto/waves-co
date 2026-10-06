/**
 * POST /api/notifications/[id]/read — Mark a notification as read
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markNotificationRead } from "@/lib/notifications";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const success = await markNotificationRead(session.user.tenantId, id);

  return NextResponse.json({ success });
}
