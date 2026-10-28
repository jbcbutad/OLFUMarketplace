"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

// Shared by the inbox (left) and the open conversation (right):
//  - onlineUserIds:   who is online right now (Supabase presence)
//  - selectedRoomId:  the room the right-hand panel resolved to. This matters
//                     for /chat/new?sellerId=..., where the URL segment isn't
//                     the real room id yet.
const ChatShellContext = createContext({
    onlineUserIds: new Set(),
    selectedRoomId: null,
    setSelectedRoomId: () => { },
});

export const useChatShell = () => useContext(ChatShellContext);

export function ChatShellProvider({ children }) {
    const [onlineUserIds, setOnlineUserIds] = useState(new Set());
    const [selectedRoomId, setSelectedRoomId] = useState(null);

    // Online presence (moved here from the old ChatHub page so both panels can use it)
    useEffect(() => {
        let channel = null;
        let isMounted = true;

        (async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user || !isMounted) return;

            channel = supabase.channel("presence:users-online", {
                config: { presence: { key: String(user.id) } },
            });

            const recomputeOnline = () => {
                if (!isMounted) return;
                const state = channel.presenceState();
                const ids = new Set();
                for (const presences of Object.values(state || {})) {
                    for (const p of presences || []) {
                        if (p?.user_id) ids.add(String(p.user_id));
                    }
                }
                setOnlineUserIds(ids);
            };

            channel.on("presence", { event: "sync" }, recomputeOnline);
            channel.on("presence", { event: "join" }, recomputeOnline);
            channel.on("presence", { event: "leave" }, recomputeOnline);

            await channel.subscribe(async (status) => {
                if (status !== "SUBSCRIBED") return;
                await channel.track({
                    user_id: user.id,
                    online_at: new Date().toISOString(),
                });
            });
        })();

        return () => {
            isMounted = false;
            if (channel) supabase.removeChannel(channel);
        };
    }, []);

    return (
        <ChatShellContext.Provider value={{ onlineUserIds, selectedRoomId, setSelectedRoomId }}>
            {children}
        </ChatShellContext.Provider>
    );
}
