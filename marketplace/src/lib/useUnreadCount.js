"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

// One shared store for the whole page. Navbar and Sidebar both call the hook,
// but there is only ONE realtime channel and ONE rpc call per event.
let count = 0;
const listeners = new Set();
let channel = null;
let channelUserId = null;
let timer = null;
let inflight = false;
let rerun = false;
let lastRefresh = 0;
let authSub = null;

const emit = () => listeners.forEach((l) => l(count));

function removeChannel() {
    if (channel) supabase.removeChannel(channel);
    channel = null;
    channelUserId = null;
}

function ensureChannel(userId) {
    if (channelUserId === userId) return;
    removeChannel();
    channelUserId = userId;
    // Only messages sent BY OTHER PEOPLE can raise my unread count.
    // Read / archive / block / delete actions arrive through the window events below.
    channel = supabase
        .channel(`unread-${userId}`)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "direct_messages",
                filter: `sender_id=neq.${userId}`,
            },
            scheduleRefresh
        )
        .subscribe();
}

async function refresh() {
    if (inflight) {
        rerun = true;
        return;
    }
    inflight = true;
    lastRefresh = Date.now();
    try {
        const {
            data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
            removeChannel();
            count = 0;
            emit();
            return;
        }

        ensureChannel(session.user.id);

        const { data, error } = await supabase.rpc("get_unread_conversation_count");
        if (!error) {
            count = Number(data) || 0;
            emit();
        }
    } finally {
        inflight = false;
        if (rerun) {
            rerun = false;
            scheduleRefresh();
        }
    }
}

function scheduleRefresh() {
    clearTimeout(timer);
    timer = setTimeout(refresh, 300);
}

// Tab regained focus: catches reads done on another device, but not more than once per 10s
function onFocusish() {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - lastRefresh > 10_000) scheduleRefresh();
}

function start() {
    window.addEventListener("messages-read", scheduleRefresh);
    window.addEventListener("unread-refresh", scheduleRefresh);
    window.addEventListener("focus", onFocusish);
    document.addEventListener("visibilitychange", onFocusish);

    const {
        data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
            removeChannel();
            count = 0;
            emit();
        }
        if (event === "SIGNED_IN" && !channelUserId) scheduleRefresh();
    });
    authSub = subscription;

    refresh();
}

function stop() {
    clearTimeout(timer);
    window.removeEventListener("messages-read", scheduleRefresh);
    window.removeEventListener("unread-refresh", scheduleRefresh);
    window.removeEventListener("focus", onFocusish);
    document.removeEventListener("visibilitychange", onFocusish);
    authSub?.unsubscribe();
    authSub = null;
    removeChannel();
}

export default function useUnreadCount() {
    const [value, setValue] = useState(count);

    useEffect(() => {
        listeners.add(setValue);
        setValue(count);
        if (listeners.size === 1) start();

        return () => {
            listeners.delete(setValue);
            if (listeners.size === 0) stop();
        };
    }, []);

    return value;
}