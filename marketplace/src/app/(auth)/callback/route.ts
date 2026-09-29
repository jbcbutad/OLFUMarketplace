import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";


export async function GET(request: Request) {
    console.log("🔥 AUTH CALLBACK HIT:", request.url);
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");

    if (!code) {
        return NextResponse.redirect(
            new URL("/login?error=AuthFailed", requestUrl.origin)
        );
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },

                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                },
            },
        }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
        console.error("OAuth callback error:", error);

        return NextResponse.redirect(
            new URL("/login?error=AuthFailed", requestUrl.origin)
        );
    }

    // Successful Google login
    return NextResponse.redirect(
        new URL("/marketplace", requestUrl.origin)
    );
}
