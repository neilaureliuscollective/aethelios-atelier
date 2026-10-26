import { NextResponse, type NextRequest } from "next/server";
import { RETIRED_API_PREFIXES, RETIRED_ROUTES } from "@/lib/publicSite";

function under(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Accounts, client workspaces, and the older brief tools are not part of the public launch. */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (RETIRED_API_PREFIXES.some((prefix) => under(pathname, prefix))) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const route = RETIRED_ROUTES.find((item) => under(pathname, item.prefix));
  if (route) {
    return NextResponse.redirect(new URL(route.destination, request.url), 307);
  }
  return NextResponse.next();
}

// Literal list required by Next.js; publicSite.test.ts keeps it in step with RETIRED_ROUTES.
export const config = {
  matcher: [
    "/project/:path*",
    "/discover/:path*",
    "/account/:path*",
    "/companion/:path*",
    "/workspace/:path*",
    "/founder/:path*",
    "/api/projects/:path*",
    "/api/founder/:path*",
    "/api/companion/:path*",
    "/api/session/sign-in/:path*",
    "/api/session/start/:path*",
    "/api/session/email/:path*",
    "/api/auth/:path*"
  ]
};
