"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

// Fallback check interval. Realtime (below) is instant when it's enabled for `profiles`;
// this covers the case where it isn't, or the websocket dropped.
const POLL_MS = 30_000;

/**
 * Mount once in the root layout. If the signed-in user's profile becomes banned,
 * it clears their session and hard-redirects to /login?error=Banned, so they
 * don't need to refresh or log out themselves.
 *
 * This is a UX layer. The real enforcement (RLS / triggers / middleware) must
 * still block a banned user's requests on the server.
 */
export default function BanGuard() {
    useEffect(() => {
        // Banned users land on /login. Never run there, so there's no redirect loop.
        if (window.location.pathname.startsWith("/login")) return;

        let cancelled = false;
        let kicked = false;
        let userId: string | null = null;
        let timer: ReturnType<typeof setInterval> | null = null;
        let channel: ReturnType<typeof supabase.channel> | null = null;

        const kick = async () => {
            if (kicked) return;
            kicked = true;
            try {
                // "local" only clears this browser's session; the server already revoked it.
                await supabase.auth.signOut({ scope: "local" });
            } catch (err) {
                console.error("[BanGuard] signOut failed:", err);
            } finally {
                window.location.replace("/login?error=Banned");
            }
        };

        const check = async () => {
            if (cancelled || kicked || !userId) return;
            const { data } = await supabase
                .from("profiles")
                .select("is_banned")
                .eq("id", userId)
                .maybeSingle();
            if (data?.is_banned) kick();
        };

        const onVisible = () => {
            if (document.visibilityState === "visible") check();
        };

        (async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (cancelled || !session) return;

            userId = session.user.id;

            check(); // catches a ban that happened while the tab was closed
            timer = setInterval(check, POLL_MS);
            document.addEventListener("visibilitychange", onVisible);
            window.addEventListener("focus", check);

            // Instant path: needs `profiles` in the supabase_realtime publication.
            channel = supabase
                .channel(`ban-watch-${userId}`)
                .on(
                    "postgres_changes",
                    {
                        event: "UPDATE",
                        schema: "public",
                        table: "profiles",
                        filter: `id=eq.${userId}`,
                    },
                    (payload) => {
                        if ((payload.new as { is_banned?: boolean } | null)?.is_banned) kick();
                    }
                )
                .subscribe();
        })();

        return () => {
            cancelled = true;
            if (timer) clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", check);
            if (channel) supabase.removeChannel(channel);
        };
    }, []);

    return null;
}