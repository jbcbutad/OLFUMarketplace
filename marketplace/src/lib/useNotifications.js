"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const POLL_MS = 60_000;

// Cheap unread badge: one indexed head-count, only while the tab is visible.
export function useUnreadNotifications(userId) {
    const [count, setCount] = useState(0);

    const refresh = useCallback(async () => {
        if (!userId) return;
        const { count: n, error } = await supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .is("read_at", null);
        if (!error) setCount(n ?? 0);
    }, [userId]);

    useEffect(() => {
        if (!userId) {
            setCount(0);
            return;
        }
        const tick = () => {
            if (document.visibilityState === "visible") refresh();
        };
        tick();
        const timer = setInterval(tick, POLL_MS);
        document.addEventListener("visibilitychange", tick);
        window.addEventListener("notifications:changed", refresh);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", tick);
            window.removeEventListener("notifications:changed", refresh);
        };
    }, [userId, refresh]);

    return count;
}