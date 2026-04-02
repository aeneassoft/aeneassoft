import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const locales = ["en", "de"];
const defaultLocale = "en";

function getLocale(request: NextRequest): string {
  const acceptLanguage = request.headers.get("accept-language") || "";
  const preferred = acceptLanguage
    .split(",")
    .map((l) => l.split(";")[0].trim().toLowerCase());

  for (const lang of preferred) {
    if (locales.includes(lang)) return lang;
    const short = lang.split("-")[0];
    if (locales.includes(short)) return short;
  }

  return defaultLocale;
}

function pathnameHasLocale(pathname: string): boolean {
  return locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );
}

function getPathnameWithoutLocale(pathname: string): string {
  for (const locale of locales) {
    if (pathname.startsWith(`/${locale}/`)) return pathname.slice(locale.length + 1);
    if (pathname === `/${locale}`) return "/";
  }
  return pathname;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files, api routes, and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // If no locale prefix, redirect to locale-prefixed path
  if (!pathnameHasLocale(pathname)) {
    const locale = getLocale(request);
    request.nextUrl.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(request.nextUrl);
  }

  const rawPath = getPathnameWithoutLocale(pathname);

  // Dashboard routes — require JWT token cookie (unless local mode)
  if (rawPath === "/dashboard" || rawPath.startsWith("/dashboard/")) {
    // Local mode: skip auth check entirely
    if (process.env.NEXT_PUBLIC_LOCAL_MODE === "true") {
      return NextResponse.next();
    }
    const tokenCookie = request.cookies.get("token");
    if (!tokenCookie?.value) {
      const locale = locales.find((l) => pathname.startsWith(`/${l}`)) || defaultLocale;
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
