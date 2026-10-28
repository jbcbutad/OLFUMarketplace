"use client";

import { toast } from "sonner";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import { useChatShell } from "./ChatShellContext";
import {
    Search,
    Loader2,
    Archive,
    ArchiveRestore,
    MoreVertical,
    User as UserIcon,
    Mail,
    MailOpen,
    Ban,
    Check,
    Trash2,
    ChevronDown,
    X,
} from "lucide-react";

const MENU_HEIGHT = 200;
const LINE = "border-neutral-200 dark:border-neutral-800";
const MUTED = "text-neutral-500 dark:text-neutral-400";

// Same day -> "3:43 AM", otherwise "21/10"
function formatListDate(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    if (d.toDateString() === new Date().toDateString()) {
        return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    }
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm}`;
}

export default function ChatSidebar() {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [showSearch, setShowSearch] = useState(false);
    const [existingRooms, setExistingRooms] = useState([]);
    const [roomLastMessages, setRoomLastMessages] = useState({});
    const [roomUnreadStatus, setRoomUnreadStatus] = useState({});
    const [relations, setRelations] = useState({}); // otherUserId -> { iBlocked, blockedMe }
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(null);
    const [activeTab, setActiveTab] = useState("active"); // "active" | "archived"
    const [viewMenuOpen, setViewMenuOpen] = useState(false); // the "Inbox ▾" dropdown
    const [menu, setMenu] = useState(null); // { roomId, top, right }
    const [confirm, setConfirm] = useState(null); // { type: "block" | "unblock" | "delete", room }
    const router = useRouter();

    // Which conversation is open on the right
    const segment = useSelectedLayoutSegment();
    const { onlineUserIds, selectedRoomId } = useChatShell();
    const activeId = selectedRoomId || segment;

    const showToast = (message, type = "info") => {
        if (type === "success") toast.success(message);
        else if (type === "error") toast.error(message);
        else toast(message);
    };

    // First load
    useEffect(() => {
        loadRooms();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep the list live: a new/updated message re-sorts the list and updates unread dots
    useEffect(() => {
        if (!currentUser) return;

        let timer = null;
        const scheduleReload = () => {
            clearTimeout(timer);
            timer = setTimeout(() => loadRooms({ silent: true }), 1500);
        };

        const channel = supabase
            .channel(`chat-hub-${currentUser.id}`)
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "direct_messages" },
                scheduleReload
            )
            .subscribe();

        window.addEventListener("unread-refresh", scheduleReload);
        window.addEventListener("messages-read", scheduleReload);

        return () => {
            clearTimeout(timer);
            supabase.removeChannel(channel);
            window.removeEventListener("unread-refresh", scheduleReload);
            window.removeEventListener("messages-read", scheduleReload);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser]);

    async function loadRooms({ silent = false } = {}) {
        const {
            data: { session },
            error: authErr,
        } = await supabase.auth.getSession();
        const user = session?.user;

        // A logged-out visitor makes getUser() return an "Auth session missing" error,
        // so check for "no user" first and send them to login instead of spinning forever.
        if (!user) return router.push("/login");
        if (authErr) {
            console.error("Auth error:", authErr);
            setLoading(false);
            return;
        }

        setCurrentUser((prev) => (prev?.id === user.id ? prev : user));

        // 1) My rooms (hide the ones I deleted)
        const { data: myMemberships, error: memErr } = await supabase
            .from("direct_room_members")
            .select("room_id, archived_at, deleted_at, marked_unread")
            .eq("user_id", user.id);

        if (memErr) {
            console.error("Membership error:", memErr);
            setLoading(false);
            return;
        }

        const memberInfo = {};
        for (const m of myMemberships || []) {
            if (m.deleted_at) continue;
            memberInfo[m.room_id] = {
                archivedAt: m.archived_at ?? null,
                markedUnread: !!m.marked_unread,
            };
        }

        const roomIds = Object.keys(memberInfo);
        if (roomIds.length === 0) {
            setExistingRooms([]);
            setRoomLastMessages({});
            setRoomUnreadStatus({});
            setLoading(false);
            return;
        }

        // 2) Every member of those rooms
        const { data: roomsMembers, error: detailsErr } = await supabase
            .from("direct_room_members")
            .select("room_id, user_id")
            .in("room_id", roomIds);

        if (detailsErr) {
            console.error("Room members error:", detailsErr);
            setLoading(false);
            return;
        }

        const membersByRoom = {};
        const otherUserIdsSet = new Set();

        for (const row of roomsMembers || []) {
            if (!membersByRoom[row.room_id]) membersByRoom[row.room_id] = [];
            membersByRoom[row.room_id].push(row);

            if (row.user_id !== user.id) {
                otherUserIdsSet.add(row.user_id);
            }
        }

        const otherUserIds = [...otherUserIdsSet];
        const otherUsersById = {};

        if (otherUserIds.length > 0) {
            const { data: otherUsers, error: usersErr } = await supabase
                .from("users")
                .select('id, "First_Name", "Last_Name", avatar_url')
                .in("id", otherUserIds);

            if (usersErr) {
                console.error("Users error:", usersErr);
            }

            for (const u of otherUsers || []) {
                otherUsersById[u.id] = u;
            }
        }

        // image_urls is new here: it powers the product thumbnail on each row
        const { data: roomRows } = await supabase
            .from("direct_rooms")
            .select("id, created_at, product_id, products(title, image_urls)")
            .in("id", roomIds);
        const roomMeta = {};
        for (const r of roomRows || []) roomMeta[r.id] = r;

        const normalized = roomIds.map((roomId) => {
            const members = membersByRoom[roomId] || [];
            const otherMember = members.find((m) => m.user_id !== user.id) || null;

            const otherProfile = otherMember
                ? otherUsersById[otherMember.user_id] || null
                : null;

            return {
                id: roomId,
                otherUser: otherProfile,
                otherUserId: otherMember ? otherMember.user_id : null,
                product_id: roomMeta[roomId]?.product_id ?? null,
                productTitle: roomMeta[roomId]?.products?.title ?? null,
                productImage: roomMeta[roomId]?.products?.image_urls?.[0] ?? null,
                createdAt: roomMeta[roomId]?.created_at ?? null,
                archivedAt: memberInfo[roomId].archivedAt,
                markedUnread: memberInfo[roomId].markedUnread,
            };
        });

        setExistingRooms(normalized);

        // 3) Latest message per room
        const { data: lastMsgs, error: lastErr } = await supabase.rpc(
            "get_my_room_last_messages",
            { p_room_ids: roomIds }
        );

        if (lastErr) {
            console.error("Last messages error:", lastErr);
        } else {
            const map = {};
            for (const m of lastMsgs || []) {
                if (!map[m.room_id]) map[m.room_id] = m;
            }
            setRoomLastMessages(map);
        }

        // 4) Rooms with unread incoming messages
        const { data: unreadMsgs, error: unreadErr } = await supabase
            .from("direct_messages")
            .select("room_id")
            .in("room_id", roomIds)
            .eq("is_read", false)
            .neq("sender_id", user.id);

        if (!unreadErr && unreadMsgs) {
            const unreadMap = {};
            for (const msg of unreadMsgs) {
                unreadMap[msg.room_id] = true;
            }
            setRoomUnreadStatus(unreadMap);
        }

        // 5) Who is blocked (either direction)
        const { data: rels } = await supabase.rpc("get_my_block_relations");
        const relMap = {};
        for (const r of rels || []) {
            relMap[r.other_id] = { iBlocked: !!r.i_blocked, blockedMe: !!r.blocked_me };
        }
        setRelations(relMap);

        setLoading(false);
    }

    // ---------- helpers ----------
    const isRoomBlocked = (room) => {
        const rel = room.otherUserId ? relations[room.otherUserId] : null;
        return !!(rel && (rel.iBlocked || rel.blockedMe));
    };

    // The conversation you're looking at right now never counts as unread
    const roomHasUnread = (room) =>
        room.id !== activeId &&
        !isRoomBlocked(room) &&
        (!!roomUnreadStatus[room.id] || room.markedUnread);

    const sortKey = (room) =>
        new Date(roomLastMessages[room.id]?.created_at || room.createdAt || 0).getTime();

    // ---------- row actions ----------
    async function setRoomRead(room, read) {
        setMenu(null);

        // Update the screen immediately
        setExistingRooms((prev) =>
            prev.map((r) => (r.id === room.id ? { ...r, markedUnread: !read } : r))
        );
        if (read) {
            setRoomUnreadStatus((prev) => ({ ...prev, [room.id]: false }));
        }

        const { error } = await supabase.rpc(read ? "mark_room_read" : "mark_room_unread", {
            p_room: room.id,
        });

        if (error) {
            console.error("Read/unread error:", error);
            showToast(read ? "Failed to mark as read" : "Failed to mark as unread", "error");
            loadRooms({ silent: true });
            return;
        }

        window.dispatchEvent(new Event("unread-refresh"));
    }

    async function toggleArchive(room) {
        const willArchive = !room.archivedAt;
        const previous = room.archivedAt;
        setMenu(null);

        setExistingRooms((prev) =>
            prev.map((r) =>
                r.id === room.id
                    ? { ...r, archivedAt: willArchive ? new Date().toISOString() : null }
                    : r
            )
        );

        const { error } = await supabase.rpc(
            willArchive ? "archive_direct_room" : "unarchive_direct_room",
            { p_room: room.id }
        );

        if (error) {
            console.error("Archive error:", error);
            setExistingRooms((prev) =>
                prev.map((r) => (r.id === room.id ? { ...r, archivedAt: previous } : r))
            );
            showToast("Something went wrong. Try again.", "error");
            return;
        }

        window.dispatchEvent(new Event("unread-refresh"));
    }

    async function executeBlock(room) {
        if (!currentUser || !room.otherUserId) return;
        const { error } = await supabase
            .from("blocked_users")
            .upsert(
                { blocker_id: currentUser.id, blocked_id: room.otherUserId },
                { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true }
            );

        if (error) {
            console.error("Block error:", error);
            showToast("Failed to block user", "error");
            return;
        }

        setRelations((prev) => ({
            ...prev,
            [room.otherUserId]: { iBlocked: true, blockedMe: prev[room.otherUserId]?.blockedMe || false },
        }));
        showToast("User blocked", "success");
        window.dispatchEvent(new Event("unread-refresh"));
    }

    async function executeUnblock(room) {
        if (!currentUser || !room.otherUserId) return;
        const { error } = await supabase
            .from("blocked_users")
            .delete()
            .eq("blocker_id", currentUser.id)
            .eq("blocked_id", room.otherUserId);

        if (error) {
            console.error("Unblock error:", error);
            showToast("Failed to unblock user", "error");
            return;
        }

        setRelations((prev) => ({
            ...prev,
            [room.otherUserId]: { iBlocked: false, blockedMe: prev[room.otherUserId]?.blockedMe || false },
        }));
        showToast("User unblocked", "success");
        window.dispatchEvent(new Event("unread-refresh"));
    }

    async function executeDelete(room) {
        // Remove from the screen immediately
        setExistingRooms((prev) => prev.filter((r) => r.id !== room.id));

        // If that's the conversation on the right, close it
        if (room.id === activeId) router.push("/chat");

        const { error } = await supabase.rpc("delete_direct_room", { p_room: room.id });

        if (error) {
            console.error("Delete error:", error);
            showToast("Failed to delete conversation", "error");
            loadRooms({ silent: true });
            return;
        }

        showToast("Conversation deleted", "success");
        window.dispatchEvent(new Event("unread-refresh"));
    }

    async function handleConfirm() {
        if (!confirm) return;
        const { type, room } = confirm;
        setConfirm(null);
        if (type === "block") await executeBlock(room);
        if (type === "unblock") await executeUnblock(room);
        if (type === "delete") await executeDelete(room);
    }

    function openMenu(e, room) {
        e.stopPropagation();
        if (menu?.roomId === room.id) {
            setMenu(null);
            return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        const openUp = rect.bottom + MENU_HEIGHT > window.innerHeight;
        setMenu({
            roomId: room.id,
            top: openUp ? Math.max(8, rect.top - MENU_HEIGHT) : rect.bottom + 4,
            right: Math.max(8, window.innerWidth - rect.right),
        });
    }

    // ---------- search / start chat ----------
    function toggleSearch() {
        setShowSearch((open) => !open);
        setSearchQuery("");
        setSearchResults([]);
    }

    async function handleSearch(query) {
        setSearchQuery(query);

        if (query.trim().length < 2) {
            searchResults.length > 0 && setSearchResults([]);
            return;
        }

        if (!currentUser) return;

        const { data, error } = await supabase
            .from("users")
            .select('id, "First_Name", "Last_Name", avatar_url')
            .neq("id", currentUser.id)
            .or(`"First_Name".ilike.%${query}%, "Last_Name".ilike.%${query}%`)
            .limit(5);

        if (error) {
            console.error("Search error:", error);
            setSearchResults([]);
            return;
        }

        setSearchResults(data || []);
    }

    async function startChat(targetUser) {
        if (!currentUser) return;

        const targetUserId = targetUser?.id;
        if (!targetUserId) return;

        // Includes archived rooms on purpose: sending a message there unarchives it
        const existingRoom = existingRooms.find(
            (room) => room.otherUserId === targetUserId && !room.product_id
        );

        setSearchQuery("");
        setSearchResults([]);
        setShowSearch(false);

        if (existingRoom) {
            router.push(`/chat/${existingRoom.id}`);
            return;
        }

        const { data: roomId, error } = await supabase.rpc("get_or_create_direct_room", {
            p_other_user: targetUserId,
        });

        if (error) {
            console.error("Failed to create room:", error);
            return;
        }

        if (roomId) {
            router.push(`/chat/${roomId}`);
            window.dispatchEvent(new Event("unread-refresh")); // show the new room in the list
        }
    }

    // ---------- derived lists ----------
    const activeRooms = existingRooms.filter((r) => !r.archivedAt);
    const archivedRooms = existingRooms.filter((r) => r.archivedAt);
    const visibleRooms = [...(activeTab === "archived" ? archivedRooms : activeRooms)].sort(
        (a, b) => sortKey(b) - sortKey(a) // most recent conversation first
    );
    const archivedHasUnread = archivedRooms.some((r) => roomHasUnread(r));

    const menuRoom = menu ? existingRooms.find((r) => r.id === menu.roomId) : null;
    const menuRel = menuRoom?.otherUserId ? relations[menuRoom.otherUserId] : null;
    const menuHasUnread = menuRoom ? roomHasUnread(menuRoom) : false;

    const confirmName = confirm
        ? `${confirm.room.otherUser?.First_Name || ""} ${confirm.room.otherUser?.Last_Name || ""}`.trim() ||
        "this user"
        : "";

    return (
        <>
            {/* HEADER: "Inbox ▾" + search */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${LINE} shrink-0`}>
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setViewMenuOpen((o) => !o)}
                        aria-haspopup="menu"
                        aria-expanded={viewMenuOpen}
                        className="flex items-center gap-1.5 text-xl font-semibold text-foreground cursor-pointer"
                    >
                        {activeTab === "archived" ? "Archived" : "Inbox"}
                        <ChevronDown
                            size={18}
                            className={`transition-transform ${viewMenuOpen ? "rotate-180" : ""}`}
                        />
                        {activeTab !== "archived" && archivedHasUnread && (
                            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                        )}
                    </button>

                    {viewMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setViewMenuOpen(false)} />
                            <div
                                role="menu"
                                className={`absolute left-0 top-full mt-2 w-48 bg-white dark:bg-neutral-900 border ${LINE} rounded-xl shadow-2xl overflow-hidden z-50 py-1`}
                            >
                                {[
                                    { key: "active", label: "Inbox", count: activeRooms.length },
                                    { key: "archived", label: "Archived", count: archivedRooms.length },
                                ].map((opt) => (
                                    <button
                                        key={opt.key}
                                        role="menuitem"
                                        type="button"
                                        onClick={() => {
                                            setActiveTab(opt.key);
                                            setViewMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left font-semibold text-sm text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                                    >
                                        {opt.key === "archived" ? <Archive size={15} /> : <Mail size={15} />}
                                        <span className="flex-1">{opt.label}</span>
                                        {opt.count > 0 && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800">
                                                {opt.count}
                                            </span>
                                        )}
                                        {activeTab === opt.key && <Check size={15} />}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <button
                    type="button"
                    onClick={toggleSearch}
                    title={showSearch ? "Close search" : "Search people"}
                    aria-label={showSearch ? "Close search" : "Search people"}
                    className="p-2 rounded-full text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                    {showSearch ? <X size={20} /> : <Search size={20} />}
                </button>
            </div>

            {/* PEOPLE SEARCH (opens from the magnifier) */}
            {showSearch && (
                <div className={`relative px-3 py-3 border-b ${LINE} shrink-0`}>
                    <Search
                        className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-400"
                        size={16}
                    />
                    {/* text-base on mobile stops iOS from zooming in on focus */}
                    <input
                        autoFocus
                        type="text"
                        placeholder="Search people to chat..."
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full bg-background border border-neutral-300 dark:border-neutral-700 text-foreground rounded-xl py-2.5 pl-10 pr-4 text-base md:text-sm outline-none focus:ring-2 focus:ring-foreground transition-all placeholder:text-neutral-400"
                    />

                    {searchResults.length > 0 && (
                        <div
                            className={`absolute z-50 left-3 right-3 top-full mt-1 bg-background border ${LINE} rounded-xl overflow-hidden shadow-2xl`}
                        >
                            {searchResults.map((u) => (
                                <button
                                    key={u.id}
                                    onClick={async () => {
                                        await startChat(u);
                                    }}
                                    className={`w-full flex items-center gap-3 p-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 border-b ${LINE} last:border-0 transition-colors cursor-pointer`}
                                >
                                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs overflow-hidden shrink-0">
                                        {u.avatar_url ? (
                                            <img src={u.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            u.First_Name?.[0] || "?"
                                        )}
                                    </div>
                                    <span className="font-medium text-foreground truncate">
                                        {u.First_Name} {u.Last_Name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* CONVERSATION LIST */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {loading ? (
                    <div className="flex justify-center p-10">
                        <Loader2 className="animate-spin text-foreground" />
                    </div>
                ) : visibleRooms.length === 0 ? (
                    <div className="text-center p-6 md:p-10 text-neutral-400 text-sm">
                        {activeTab === "archived" ? (
                            <>
                                <Archive className="mx-auto mb-2 opacity-30" size={48} />
                                <p>No archived chats.</p>
                            </>
                        ) : (
                            <>
                                <UserIcon className="mx-auto mb-2 opacity-30" size={48} />
                                <p>
                                    {archivedRooms.length > 0
                                        ? "No active chats. Check Archived from the Inbox menu, or search for someone!"
                                        : "No active chats yet. Use the search icon to find someone!"}
                                </p>
                            </>
                        )}
                    </div>
                ) : (
                    visibleRooms.map((room) => {
                        const other = room.otherUser;
                        const otherUserOnline =
                            room.otherUserId && onlineUserIds.has(String(room.otherUserId));
                        const last = roomLastMessages[room.id];
                        const hasUnread = roomHasUnread(room);
                        const rel = room.otherUserId ? relations[room.otherUserId] : null;
                        const selected = room.id === activeId;

                        const otherName = other
                            ? `${other.First_Name || ""} ${other.Last_Name || ""}`.trim() || "User"
                            : "User";

                        let preview = "Click to open conversation";
                        if (last) {
                            const prefix = last.sender_id === currentUser?.id ? "You: " : "";
                            preview = prefix + (last.is_unsent ? "Message was unsent" : last.body || "");
                        }
                        if (rel?.iBlocked) preview = "You blocked this user";

                        const open = () => router.push(`/chat/${room.id}`);

                        return (
                            <div
                                key={room.id}
                                role="button"
                                tabIndex={0}
                                onClick={open}
                                onKeyDown={(e) => {
                                    if (e.target !== e.currentTarget) return; // ignore keys from the ⋮ button
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        open();
                                    }
                                }}
                                className={`flex items-start gap-3 px-3 py-3 border-b ${LINE} cursor-pointer transition-colors outline-none focus-visible:bg-neutral-100 dark:focus-visible:bg-neutral-800 ${selected
                                    ? "bg-neutral-200 dark:bg-neutral-700/50"
                                    : "hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                                    }`}
                            >
                                {/* Avatar + online dot */}
                                <div className="relative w-10 h-10 shrink-0">
                                    <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold overflow-hidden border border-neutral-300 dark:border-neutral-700">
                                        {other?.avatar_url ? (
                                            <img src={other.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                        ) : (
                                            other?.First_Name?.[0] || "?"
                                        )}
                                    </div>
                                    <div
                                        className={`absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-background ${otherUserOnline ? "bg-green-500" : "bg-neutral-400"
                                            }`}
                                    />
                                </div>

                                {/* Name / date / title / preview */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <p
                                            className={`truncate text-xs text-foreground ${hasUnread ? "font-bold" : "font-medium"
                                                }`}
                                        >
                                            {otherName}
                                        </p>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {hasUnread && <span className="w-2 h-2 bg-emerald-500 rounded-full" />}
                                            <span className={`text-xs ${MUTED}`}>
                                                {formatListDate(last?.created_at || room.createdAt)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => openMenu(e, room)}
                                                className="p-1 -mr-1 rounded-full text-neutral-500 hover:text-foreground hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                                                title="More options"
                                                aria-label="More options"
                                            >
                                                <MoreVertical size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {room.product_id ? (
                                        <>
                                            <p className="truncate text-sm font-bold text-foreground mt-0.5">
                                                {room.productTitle || "Listing"}
                                            </p>
                                            <p
                                                className={`truncate text-sm ${hasUnread ? "text-foreground font-semibold" : MUTED
                                                    }`}
                                            >
                                                {preview}
                                            </p>
                                        </>
                                    ) : (
                                        <p
                                            className={`truncate text-sm mt-1 ${hasUnread ? "text-foreground font-bold" : "text-foreground"
                                                }`}
                                        >
                                            {preview}
                                        </p>
                                    )}
                                </div>

                                {/* Product thumbnail */}
                                {room.productImage && (
                                    <img
                                        src={room.productImage}
                                        alt=""
                                        className="w-14 h-14 rounded-md object-cover shrink-0 border border-neutral-300 dark:border-neutral-700 bg-neutral-200 dark:bg-neutral-800"
                                    />
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* ROW MENU (fixed so the list never clips it) */}
            {menu && menuRoom && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
                    <div
                        className="fixed w-52 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl overflow-hidden z-50 py-1"
                        style={{ top: menu.top, right: menu.right }}
                    >
                        <button
                            type="button"
                            onClick={() => setRoomRead(menuRoom, menuHasUnread)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left font-semibold text-xs text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                            {menuHasUnread ? <MailOpen size={15} /> : <Mail size={15} />}
                            {menuHasUnread ? "Mark as read" : "Mark as unread"}
                        </button>

                        <button
                            type="button"
                            onClick={() => toggleArchive(menuRoom)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left font-semibold text-xs text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                            {menuRoom.archivedAt ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                            {menuRoom.archivedAt ? "Unarchive" : "Archive"}
                        </button>

                        {menuRoom.otherUserId &&
                            (menuRel?.iBlocked ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setConfirm({ type: "unblock", room: menuRoom });
                                        setMenu(null);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left font-semibold text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                                >
                                    <Check size={15} /> Unblock user
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setConfirm({ type: "block", room: menuRoom });
                                        setMenu(null);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left font-semibold text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                >
                                    <Ban size={15} /> Block user
                                </button>
                            ))}

                        <button
                            type="button"
                            onClick={() => {
                                setConfirm({ type: "delete", room: menuRoom });
                                setMenu(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left font-semibold text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                            <Trash2 size={15} /> Delete conversation
                        </button>
                    </div>
                </>
            )}

            {/* CONFIRM DIALOGS */}
            {confirm?.type === "delete" && (
                <ConfirmModal
                    title="Delete conversation?"
                    description="This removes the conversation from your list. The other person will still have their copy. If they message you again, a new conversation will appear."
                    confirmLabel="Delete conversation"
                    onConfirm={handleConfirm}
                    onCancel={() => setConfirm(null)}
                />
            )}
            {confirm?.type === "block" && (
                <ConfirmModal
                    title={`Block ${confirmName}?`}
                    description="Neither of you will be able to send messages in this conversation. You can unblock them anytime."
                    confirmLabel="Block user"
                    showIcon
                    onConfirm={handleConfirm}
                    onCancel={() => setConfirm(null)}
                />
            )}
            {confirm?.type === "unblock" && (
                <ConfirmModal
                    title={`Unblock ${confirmName}?`}
                    description="Messaging will work again between both accounts."
                    confirmLabel="Unblock"
                    tone="safe"
                    onConfirm={handleConfirm}
                    onCancel={() => setConfirm(null)}
                />
            )}
        </>
    );
}
