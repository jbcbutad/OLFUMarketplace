"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { ChatShellProvider } from "./ChatShellContext";
import ChatSidebar from "./ChatSidebar";

// Two-panel messages screen.
//  Desktop (md+): inbox on the left, open conversation on the right.
//  Mobile:        one panel at a time. /chat shows the inbox,
//                 /chat/[roomId] shows the conversation (it has a back button).
//
// This layout stays mounted while you click between conversations, so the inbox
// doesn't reload or flicker. Only the right panel (`children`) changes.
export default function ChatLayout({ children }) {
    const segment = useSelectedLayoutSegment(); // null on /chat, the room id on /chat/[roomId]
    const hasRoom = !!segment;

    return (
        <ChatShellProvider>
            <div className="text-foreground w-full overflow-x-hidden">
                {/* pb-24 on mobile keeps the card clear of the fixed Superadmin footer */}
                <div className="max-w-7xl mx-auto pt-3 pb-24 px-2 sm:px-4 md:py-6 md:px-6">
                    <div className="flex h-[calc(100dvh-9rem)] min-h-[420px] md:h-[calc(100dvh-7rem)] md:min-h-[560px] bg-background text-foreground border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
                        {/* LEFT: inbox */}
                        <aside
                            className={`${hasRoom ? "hidden md:flex" : "flex"} w-full md:w-[380px] md:shrink-0 min-h-0 flex-col md:border-r border-neutral-200 dark:border-neutral-800`}
                        >
                            <ChatSidebar />
                        </aside>

                        {/* RIGHT: conversation (or the "select a message" empty state) */}
                        <section
                            className={`${hasRoom ? "flex" : "hidden md:flex"} flex-1 min-w-0 min-h-0 flex-col`}
                        >
                            {children}
                        </section>
                    </div>
                </div>
            </div>
        </ChatShellProvider>
    );
}
