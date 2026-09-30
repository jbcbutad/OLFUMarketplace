"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Search,
  MessageSquare,
  Loader2,
  Archive,
  User as UserIcon,
} from "lucide-react";

export default function ChatHub() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [existingRooms, setExistingRooms] = useState([]);
  const [roomLastMessages, setRoomLastMessages] = useState({});
  const [roomUnreadStatus, setRoomUnreadStatus] = useState({}); // Track unread per room
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("active"); // "active" | "archived"
  const router = useRouter();

  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const presenceChannelName = useMemo(() => "presence:users-online", []);

  useEffect(() => {
    initChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function initChat() {
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    const user = authData?.user;

    // A logged-out visitor makes getUser() return an "Auth session missing" error,
    // so check for "no user" first and send them to login instead of spinning forever.
    if (!user) return router.push("/login");
    if (authErr) {
      console.error("Auth error:", authErr);
      setLoading(false);
      return;
    }

    setCurrentUser(user);

    // 1) Get rooms the user is in (now also reads archived_at)
    const { data: myMemberships, error: memErr } = await supabase
      .from("direct_room_members")
      .select("room_id, archived_at")
      .eq("user_id", user.id);

    if (memErr) {
      console.error("Membership error:", memErr);
      setLoading(false);
      return;
    }

    const archivedMap = {};
    for (const m of myMemberships || []) {
      archivedMap[m.room_id] = m.archived_at ?? null;
    }

    const roomIds = [...new Set((myMemberships || []).map((m) => m.room_id))];
    if (roomIds.length === 0) {
      setExistingRooms([]);
      setRoomLastMessages({});
      setRoomUnreadStatus({});
      setLoading(false);
      return;
    }

    // 2) Load EVERY member for those rooms
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
      .select("id, product_id, products(title)")
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
        archivedAt: archivedMap[roomId] ?? null,
      };
    });

    setExistingRooms(normalized);

    // 3) Fetch latest message per room
    const { data: lastMsgs, error: lastErr } = await supabase
      .from("direct_messages")
      .select("id, room_id, sender_id, body, created_at")
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

    // 4) Fetch unread status (messages where is_read = false and sender isn't me)
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

    setLoading(false);
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

    if (existingRoom) {
      router.push(`/chat/${existingRoom.id}`);
      return;
    }

    const { data: roomId, error } = await supabase.rpc('get_or_create_direct_room', {
      p_other_user: targetUserId
    });

    if (error) {
      console.error("Failed to create room:", error);
      return;
    }

    if (roomId) {
      router.push(`/chat/${roomId}`);
    }
  }

  // Split rooms into the two tabs
  const activeRooms = existingRooms.filter((r) => !r.archivedAt);
  const archivedRooms = existingRooms.filter((r) => r.archivedAt);
  const visibleRooms = activeTab === "archived" ? archivedRooms : activeRooms;
  const archivedHasUnread = archivedRooms.some((r) => roomUnreadStatus[r.id]);

  return (
    <div className="text-foreground w-full min-h-screen transition-colors">
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
                const hasUnread = roomUnreadStatus[room.id];

                const otherName = other
                  ? `${other.First_Name || ""} ${other.Last_Name || ""}`.trim()
                  : "User";

                return (
                  <button
                    key={room.id}
                    onClick={() => router.push(`/chat/${room.id}`)}
                    className={`w-full p-4 flex items-center gap-4 border-b border-neutral-200 dark:border-neutral-800 transition-colors group text-left ${hasUnread
                      ? "bg-neutral-100/80 dark:bg-neutral-800/40 font-semibold"
                      : "hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                      }`}
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
                      <div className="flex items-center justify-between">
                        <p className={`truncate ${hasUnread ? "text-foreground font-bold" : "text-foreground font-semibold"}`}>
                          {otherName}
                        </p>
                        {hasUnread && (
                          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shrink-0"></span>
                        )}
                      </div>

                      {room.product_id && (
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                          Re: {room.productTitle || "Listing"}
                        </p>
                      )}

                      <p className={`text-xs truncate mt-0.5 ${hasUnread ? "text-foreground font-medium" : "text-neutral-500 dark:text-neutral-400"}`}>
                        {otherUserOnline ? "Online • " : "Offline • "}
                        {last
                          ? (last.sender_id === currentUser?.id
                            ? "You: "
                            : "") + (last.body || "")
                          : "Click to open conversation"}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}