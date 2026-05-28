import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE_NAME = "nova_user";

const PUBLIC_PATHS = [
  "/login",
  "/api/session/login",
  "/api/session/me",
  "/favicon.ico",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/_next/");
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();
  if (process.env.NOVA_AUTH_DISABLED === "true") return NextResponse.next();

  const userId = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (userId) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/api/:path*"],
};
