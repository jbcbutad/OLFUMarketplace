import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const url = request.nextUrl.clone();
  const isProtectedAdmin = url.pathname.startsWith("/admin");
  const isProtectedDashboard = url.pathname.startsWith("/dashboard");

  // 1. Refresh auth session token safely
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Clear broken refresh tokens to prevent auth error loops
  if (error && error.code === "refresh_token_not_found") {
    await supabase.auth.signOut();
  }

  // FAST PATH: Return immediately for public pages (e.g., /recent, /)
  if (!isProtectedAdmin && !isProtectedDashboard) {
    return supabaseResponse;
  }

  // PROTECTED PATH: Redirect unauthenticated users
  if (!user) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Fetch role only when entering restricted areas
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role || "buyer";

  // Check permissions for /admin
  if (isProtectedAdmin && role !== "admin") {
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Check permissions for /dashboard (seller or admin allowed)
  if (isProtectedDashboard && role !== "seller" && role !== "admin") {
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}