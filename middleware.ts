import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * The app subdomain IS the product: app.wavesco.in/ serves the Acquisition
 * OS Control Center dashboard directly (rewritten to /acquisition, URL
 * unchanged). The marketing site (wavesco.in, www, preview deployments,
 * localhost) keeps serving the public home page. All other paths pass
 * through untouched on every host.
 */
export function isAppHost(hostname: string): boolean {
  const bare = hostname.split(":")[0].trim().toLowerCase();
  return bare === "app.wavesco.in" || bare.endsWith(".app.wavesco.in");
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (isAppHost(host) && req.nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/acquisition", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
