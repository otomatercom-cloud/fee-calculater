import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const signedIn = req.cookies.has("fee_session");
  const onLogin = req.nextUrl.pathname === "/login";
  if (!signedIn && !onLogin) return NextResponse.redirect(new URL("/login", req.url));
  if (signedIn && onLogin) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"] };
