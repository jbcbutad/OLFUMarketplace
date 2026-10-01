"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

/**
 * Number of UNREAD CONVERSATIONS (not messages) for the signed-in user.
 * The database does the counting (get_unread_conversation_count), so
 * archived, deleted and blocked chats are handled in one place.
 *
 * Put this file at: src/lib/useUnreadCount.js
 */
export default function useUnreadCount() {
    const [count, setCount] = useState(0);
    const timerRef = useRef(null);
    const channelIdRef = useRef(`unread-${Math.random().toString(36).slice(2)}`);

    const refresh = useCallback(async () => {
        const {
            data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
            setCount(0);
            return;
        }

        const { data, error } = await supabase.rpc("get_unread_conversation_count");
        if (!error) setCount(Number(data) || 0);
    }, []);

    // Several events can fire at once (insert + read + refresh): batch them.
    const scheduleRefresh = useCallback(() => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(refresh, 300);
    }, [refresh]);

    useEffect(() => {
        refresh();

        // Any change to a message I can see (new message, read, unsent)
        const channel = supabase
            .channel(channelIdRef.current)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "direct_messages" },
                scheduleRefresh
            )
            .subscribe();

        // Fired by ChatRoom / ChatHub after read, unread, archive, block, delete
        window.addEventListener("messages-read", scheduleRefresh);
        window.addEventListener("unread-refresh", scheduleRefresh);

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event) => {
            if (event === "SIGNED_OUT") setCount(0);
            if (event === "SIGNED_IN") scheduleRefresh();
        });

        return () => {
            clearTimeout(timerRef.current);
            supabase.removeChannel(channel);
            subscription.unsubscribe();
            window.removeEventListener("messages-read", scheduleRefresh);
            window.removeEventListener("unread-refresh", scheduleRefresh);
        };
    }, [refresh, scheduleRefresh]);

    return count;
}