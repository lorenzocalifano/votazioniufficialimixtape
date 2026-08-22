import { NextRequest, NextResponse } from "next/server";
import { verifySession, JUDGE_COOKIE, MASTER_COOKIE } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/master") && !pathname.startsWith("/master/login")) {
    const payload = await verifySession(request.cookies.get(MASTER_COOKIE)?.value);
    if (!payload || payload.role !== "master") {
      return NextResponse.redirect(new URL("/master/login", request.url));
    }
  }

  if (pathname.startsWith("/vote/session")) {
    const payload = await verifySession(request.cookies.get(JUDGE_COOKIE)?.value);
    if (!payload || payload.role !== "judge") {
      return NextResponse.redirect(new URL("/vote/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/master/:path*", "/vote/session/:path*"],
};
