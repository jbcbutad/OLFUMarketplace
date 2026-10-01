import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const isBannedError = (code?: string | null, text?: string | null) =>
    code === "user_banned" || (text || "").toLowerCase().includes("banned");

export async function GET(request: Request) {
    console.log("🔥 AUTH CALLBACK HIT:", request.url);
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const bannedRedirect = () =>
        NextResponse.redirect(new URL("/login?error=Banned", requestUrl.origin));

    // Supabase sends banned users back with error params and no code
    if (
        isBannedError(
            requestUrl.searchParams.get("error_code"),
            requestUrl.searchParams.get("error_description")
        )
    ) {
        return bannedRedirect();
    }

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

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
        console.error("OAuth callback error:", error);
        if (isBannedError((error as { code?: string }).code, error.message)) {
            return bannedRedirect();
        }
        return NextResponse.redirect(
            new URL("/login?error=AuthFailed", requestUrl.origin)
        );
    }

    // Safety net: the database flag is the source of truth
    const userId = data?.user?.id;
    if (userId) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("is_banned")
            .eq("id", userId)
            .maybeSingle();

        if (profile?.is_banned) {
            await supabase.auth.signOut();
            return bannedRedirect();
        }
    }

    return NextResponse.redirect(new URL("/marketplace", requestUrl.origin));
}