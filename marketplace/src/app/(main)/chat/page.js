"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import {
  Search,
  MessageSquare,
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
  Tag,
} from "lucide-react";

const MENU_HEIGHT = 200;

export default function ChatHub() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [existingRooms, setExistingRooms] = useState([]);
  const [roomLastMessages, setRoomLastMessages] = useState({});
  const [roomUnreadStatus, setRoomUnreadStatus] = useState({});
  const [relations, setRelations] = useState({}); // otherUserId -> { iBlocked, blockedMe }
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("active"); // "active" | "archived"
  const [menu, setMenu] = useState(null); // { roomId, top, right }
  const [confirm, setConfirm] = useState(null); // { type: "block" | "unblock" | "delete", room }
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  const router = useRouter();

  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const presenceChannelName = useMemo(() => "presence:users-online", []);

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "info" }), 3000);
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
      timer = setTimeout(() => loadRooms({ silent: true }), 400);
    };

    const channel = supabase
      .channel(`chat-hub-${currentUser.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
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

  // Online presence
  useEffect(() => {
    if (!currentUser) return;

    let channel = null;
    let isMounted = true;

    (async () => {
      channel = supabase.channel(presenceChannelName, {
        config: {
          presence: { key: String(currentUser.id) },
        },
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

      channel.on("presence", { event: "sync" }, () => recomputeOnline());
      channel.on("presence", { event: "join" }, () => recomputeOnline());
      channel.on("presence", { event: "leave" }, () => recomputeOnline());

      await channel.subscribe(async (status) => {
        if (status !== "SUBSCRIBED") return;

        await channel.track({
          user_id: currentUser.id,
          online_at: new Date().toISOString(),
        });
      });
    })();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [currentUser, presenceChannelName]);

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

    const { data: roomRows } = await supabase
      .from("direct_rooms")
      .select("id, created_at, product_id, products(title)")
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
        createdAt: roomMeta[roomId]?.created_at ?? null,
        archivedAt: memberInfo[roomId].archivedAt,
        markedUnread: memberInfo[roomId].markedUnread,
      };
    });

    setExistingRooms(normalized);

    // 3) Latest message per room
    const { data: lastMsgs, error: lastErr } = await supabase
      .from("direct_messages")
      .select("id, room_id, sender_id, body, created_at, is_unsent")
      .in("room_id", roomIds)
      .order("created_at", { ascending: false });

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

    if (!silent) setLoading(false);
    else setLoading(false);
  }

  // ---------- helpers ----------
  const isRoomBlocked = (room) => {
    const rel = room.otherUserId ? relations[room.otherUserId] : null;
    return !!(rel && (rel.iBlocked || rel.blockedMe));
  };

  const roomHasUnread = (room) =>
    !isRoomBlocked(room) && (!!roomUnreadStatus[room.id] || room.markedUnread);

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
    <div className="text-foreground w-full min-h-screen transition-colors">
      {/* TOAST */}
      {toast.show && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[10000] animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-xl border text-sm font-semibold flex items-center gap-2 ${toast.type === "success"
              ? "bg-foreground text-background border-transparent"
              : toast.type === "error"
                ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                : "bg-muted border-border text-foreground"
              }`}
          >
            {toast.type === "success" && <Check size={16} className="text-emerald-500" />}
            {toast.message}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto py-10 px-4 md:px-6">
        <div className="flex flex-col h-[80vh] min-h-[600px] bg-background text-foreground border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden relative shadow-sm">
          {/* Header Area */}
          <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
            <h1 className="text-2xl font-bold mb-4 flex items-center gap-2 text-foreground">
              <MessageSquare className="text-foreground" /> Messages
            </h1>

            <div className="relative">
              <Search className="absolute left-3 top-3 text-neutral-400" size={18} />
              <input
                type="text"
                placeholder="Search people to chat..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full bg-background border border-neutral-300 dark:border-neutral-700 text-foreground rounded-xl py-2.5 pl-10 pr-4 outline-none focus:ring-2 focus:ring-foreground transition-all placeholder:text-neutral-400"
              />

              {searchResults.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-2 bg-background border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
                  {searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={async () => {
                        await startChat(u);
                      }}
                      className="w-full flex items-center justify-between p-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-800 last:border-0 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs overflow-hidden shrink-0">
                          {u.avatar_url ? (
                            <img
                              src={u.avatar_url}
                              alt="Profile"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            u.First_Name?.[0] || "?"
                          )}
                        </div>
                        <span className="font-medium text-foreground">
                          {u.First_Name} {u.Last_Name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active / Archived tabs */}
          <div className="flex border-b border-neutral-200 dark:border-neutral-800 shrink-0">
            {[
              { key: "active", label: "Active", count: activeRooms.length },
              { key: "archived", label: "Archived", count: archivedRooms.length },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 border-b-2 ${activeTab === tab.key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-foreground"
                  }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800">
                    {tab.count}
                  </span>
                )}
                {tab.key === "archived" && archivedHasUnread && (
                  <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                )}
              </button>
            ))}
          </div>

          {/* List Area */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center p-10">
                <Loader2 className="animate-spin text-foreground" />
              </div>
            ) : visibleRooms.length === 0 ? (
              <div className="text-center p-10 text-neutral-400">
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
                        ? "No active chats. Check your Archived tab, or search for someone above!"
                        : "No active chats yet. Search for someone above!"}
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

                const otherName = other
                  ? `${other.First_Name || ""} ${other.Last_Name || ""}`.trim()
                  : "User";

                let preview = "Click to open conversation";
                if (last) {
                  const prefix = last.sender_id === currentUser?.id ? "You: " : "";
                  preview = prefix + (last.is_unsent ? "Message was unsent" : last.body || "");
                }

                return (
                  <div
                    key={room.id}
                    className={`relative border-b border-neutral-200 dark:border-neutral-800 transition-colors ${hasUnread
                      ? "bg-neutral-100/80 dark:bg-neutral-800/40 font-semibold"
                      : "hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                      }`}
                  >
                    <button
                      onClick={() => router.push(`/chat/${room.id}`)}
                      className="w-full p-4 pr-16 flex items-center gap-4 text-left cursor-pointer"
                    >
                      <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white font-bold overflow-hidden border-2 border-neutral-300 dark:border-neutral-700">
                          {other?.avatar_url ? (
                            <img
                              src={other.avatar_url}
                              alt="Profile"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            other?.First_Name?.[0] || "?"
                          )}
                        </div>

                        <div
                          className={`absolute -right-0.5 -bottom-0.5 w-3.5 h-3.5 rounded-full border-2 border-background ${otherUserOnline ? "bg-green-500" : "bg-neutral-400"
                            }`}
                        />
                      </div>

                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`truncate ${hasUnread ? "text-foreground font-bold" : "text-foreground font-semibold"
                              }`}
                          >
                            {otherName}
                          </p>
                          {hasUnread && (
                            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shrink-0"></span>
                          )}
                        </div>

                        {room.product_id && (
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate flex items-center gap-1 font-medium">
                            <Tag size={11} className="shrink-0" />
                            <span className="truncate">{room.productTitle || "Listing"}</span>
                          </p>
                        )}

                        <p
                          className={`text-xs truncate mt-0.5 ${hasUnread
                            ? "text-foreground font-medium"
                            : "text-neutral-500 dark:text-neutral-400"
                            }`}
                        >
                          {rel?.iBlocked ? (
                            "You blocked this user"
                          ) : (
                            <>
                              {otherUserOnline ? "Online • " : "Offline • "}
                              {preview}
                            </>
                          )}
                        </p>
                      </div>
                    </button>

                    {/* Row menu button */}
                    <button
                      type="button"
                      onClick={(e) => openMenu(e, room)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full text-neutral-500 hover:text-foreground hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                      title="More options"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
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
    </div>
  );
}