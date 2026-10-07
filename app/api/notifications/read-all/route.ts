/**
 * POST /api/notifications/read-all — Mark all notifications as read
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenantContext } from "@/lib/context";
import { markAllNotificationsRead } from "@/lib/notifications";

export async function POST(_request: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Run inside the tenant context so RLS can see app.tenant_id. The scope
  // cannot be widened: the helper only ever filters by this tenantId.
  const count = await withTenantContext(session.user.tenantId, () =>
    markAllNotificationsRead(session.user.tenantId as string),
  );

  return NextResponse.json({ success: true, markedCount: count });
}
