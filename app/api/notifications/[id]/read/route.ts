/**
 * POST /api/notifications/[id]/read — Mark a notification as read
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
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

  // Tenant context satisfies RLS; the helper additionally scopes by tenantId,
  // so a foreign notification id can never be marked read.
  const success = await withTenantContext(session.user.tenantId, () =>
    markNotificationRead(session.user.tenantId as string, id),
  );

  return NextResponse.json({ success });
}
