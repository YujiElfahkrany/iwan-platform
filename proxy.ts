import { auth } from "@/lib/auth";
import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

const protectedTeacherPaths = ["/en/dashboard/teacher", "/ar/dashboard/teacher"];
const protectedStudentPaths = ["/en/dashboard/student", "/ar/dashboard/student"];
const protectedAdminPaths = ["/en/dashboard/admin", "/ar/dashboard/admin"];

function getLocale(pathname: string): string {
  const seg = pathname.split("/")[1];
  return seg === "en" || seg === "ar" ? seg : "ar";
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const locale = getLocale(pathname);

  // Run i18n middleware first
  const intlResponse = intlMiddleware(req);
  if (intlResponse) return intlResponse;

  const session = await auth();

  // Auth guard for admin dashboard
  if (protectedAdminPaths.some((p) => pathname.startsWith(p))) {
    if (!session?.user) return NextResponse.redirect(new URL(`/${locale}/auth/login`, req.url));
    if (session.user.role !== "admin") return NextResponse.redirect(new URL(`/${locale}/auth/login`, req.url));
  }

  // Auth guard for teacher dashboard
  if (protectedTeacherPaths.some((p) => pathname.startsWith(p))) {
    if (!session?.user) return NextResponse.redirect(new URL(`/${locale}/auth/login`, req.url));
    if (session.user.role !== "teacher") return NextResponse.redirect(new URL(`/${locale}/dashboard/student`, req.url));
  }

  // Auth guard for student dashboard
  if (protectedStudentPaths.some((p) => pathname.startsWith(p))) {
    if (!session?.user) return NextResponse.redirect(new URL(`/${locale}/auth/login`, req.url));
    if (session.user.role !== "student") return NextResponse.redirect(new URL(`/${locale}/dashboard/teacher`, req.url));
  }

  // Session page guard
  if (pathname.includes("/session/")) {
    if (!session?.user) return NextResponse.redirect(new URL(`/${locale}/auth/login`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
