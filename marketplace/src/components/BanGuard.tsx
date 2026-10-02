"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

const POLL_MS = 60_000; // background check while the tab is visible
const MIN_GAP_MS = 10_000; // never check more often than this (tab/focus flapping)

/**
 * Mount once in the root layout. If the signed-in user's profile becomes banned,
 * it clears their session and hard-redirects to /login?error=Banned, so they
 * don't need to refresh or log out themselves.
 *
 * Deliberately NO Realtime subscription: postgres_changes adds a constant load on
 * the database. One tiny profile lookup per minute (visible tabs only) is cheaper.
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
        let lastCheck = 0;
        let timer: ReturnType<typeof setInterval> | null = null;

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
            const now = Date.now();
            if (now - lastCheck < MIN_GAP_MS) return;
            lastCheck = now;

            try {
                const { data } = await supabase
                    .from("profiles")
                    .select("is_banned")
                    .eq("id", userId)
                    .maybeSingle();
                if (data?.is_banned) kick();
            } catch (err) {
                console.error("[BanGuard] check failed:", err);
            }
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
            timer = setInterval(() => {
                if (document.visibilityState === "visible") check();
            }, POLL_MS);
            document.addEventListener("visibilitychange", onVisible);
            window.addEventListener("focus", check);
        })();

        return () => {
            cancelled = true;
            if (timer) clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisible);
            window.removeEventListener("focus", check);
        };
    }, []);

    return null;
}
