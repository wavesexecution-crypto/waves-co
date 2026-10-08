import { NextResponse } from "next/server";
import { n8nHealth } from "@/lib/n8n";

export const dynamic = "force-dynamic";

/**
 * GET /api/n8n/health — automation-layer visibility without secrets.
 * Reports only whether a base URL and signing secret are configured (never
 * values), so operators can see at a glance if n8n-backed scheduling is
 * available. Unauthenticated on purpose: it exposes no tenant data.
 */
export async function GET() {
  return NextResponse.json({ service: "n8n-bridge", ...n8nHealth() });
}
