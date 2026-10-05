import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();

  const isProtectedAdmin = url.pathname.startsWith("/admin");
  const isProtectedDashboard = url.pathname.startsWith("/dashboard");

  // ---------------------------------------------------------
  // PUBLIC ROUTES
  // ---------------------------------------------------------
  // Do NOT contact Supabase for public pages.
  //
  // This includes:
  // /login
  // /register
  // /auth/callback
  // /marketplace
  // /
  //
  // This prevents unnecessary auth requests and avoids the
  // middleware timeout during the OAuth callback.
  // ---------------------------------------------------------
  const needsAuthRefresh = url.pathname === "/marketplace";

  if (
    !isProtectedAdmin &&
    !isProtectedDashboard &&
    !needsAuthRefresh
  ) {
    return NextResponse.next();
  }

  // ---------------------------------------------------------
  // SUPABASE SERVER CLIENT
  // ---------------------------------------------------------
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          // Update request cookies
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          // Recreate response with updated request cookies
          supabaseResponse = NextResponse.next({
            request,
          });

          // Persist cookies on the response
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // ---------------------------------------------------------
  // AUTHENTICATION
  // ---------------------------------------------------------
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Only protected routes should redirect unauthenticated users.
  if ((isProtectedAdmin || isProtectedDashboard) && !user) {
    url.pathname = "/login";

    return NextResponse.redirect(url);
  }
  // ---------------------------------------------------------
  // GET USER ROLE
  // ---------------------------------------------------------
  let role = "buyer";
  let isBanned = false;

  if (user && (isProtectedAdmin || isProtectedDashboard)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_banned")
      .eq("id", user.id)
      .maybeSingle();

    role = profile?.role || "buyer";
    isBanned = !!profile?.is_banned;
  }

  if (isBanned) {
    await supabase.auth.signOut(); // clears the session cookies via setAll
    const redirect = NextResponse.redirect(new URL("/login?error=Banned", request.url));
    supabaseResponse.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  const ADMIN_ROLES = [
    "super_admin",
    "superadmin",
    "admin",
    "moderator",
  ];

  // ---------------------------------------------------------
  // ADMIN PROTECTION
  // ---------------------------------------------------------
  if (isProtectedAdmin) {
    // Only staff/admin roles can access /admin
    if (!ADMIN_ROLES.includes(role)) {
      url.pathname = "/marketplace";

      return NextResponse.redirect(url);
    }
    // Audit logs: super admins only
    if (
      url.pathname.startsWith("/admin/audit-logs") &&
      !["super_admin", "superadmin"].includes(role)
    ) {
      url.pathname = "/admin/reports";

      return NextResponse.redirect(url);
    }

    // Moderators cannot access /admin/users
    if (
      url.pathname.startsWith("/admin/users") &&
      role === "moderator"
    ) {
      url.pathname = "/admin/reports";

      return NextResponse.redirect(url);
    }
  }

  // ---------------------------------------------------------
  // DASHBOARD PROTECTION
  // ---------------------------------------------------------
  if (
    isProtectedDashboard &&
    role !== "seller" &&
    !ADMIN_ROLES.includes(role)
  ) {
    url.pathname = "/marketplace";

    return NextResponse.redirect(url);
  }

  // ---------------------------------------------------------
  // ALLOW REQUEST
  // ---------------------------------------------------------
  return supabaseResponse;
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/marketplace"],
};