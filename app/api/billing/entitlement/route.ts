import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getEntitlement } from "@/lib/billing";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const tenantId = session.user.tenantId as string;
    const ent = await getEntitlement(tenantId);
    return NextResponse.json({ entitlement: ent });
  } catch (e: any) {
    if (e.message?.includes("UNAUTHORIZED")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ error: "internal", detail: e.message }, { status: 500 });
  }
}
