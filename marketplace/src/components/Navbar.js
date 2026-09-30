"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";
import {
  User,
  LogOut,
  ChevronDown,
  Plus,
  ShoppingCart,
  ShoppingBag,
  Heart,
  MessageSquare
} from "lucide-react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import SearchBar from "@/components/SearchBar";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const router = useRouter();

  useEffect(() => {
    const initAuth = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser ?? null);

      if (currentUser) {
        const { data } = await supabase
          .from("users")
          .select("avatar_url")
          .eq("id", currentUser.id)
          .single();

        if (data?.avatar_url) {
          setAvatarUrl(data.avatar_url);
        }

        // Fetch initial unread count
        fetchUnreadCount(currentUser.id);
      }

      setLoading(false);
    };

    initAuth();

    // 👉 Auto-clear badge instantly when messages are read in ChatRoom
    const handleMessagesRead = () => {
      setUnreadCount(0);
    };
    window.addEventListener("messages-read", handleMessagesRead);

    // Realtime listener for incoming messages
    const channel = supabase
      .channel("navbar-unread-count")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        async (payload) => {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (!currentUser) return;

          if (payload.new.sender_id !== currentUser.id) {
            // Verify if user is part of the room
            const { data: memberCheck } = await supabase
              .from("direct_room_members")
              .select("room_id")
              .eq("room_id", payload.new.room_id)
              .eq("user_id", currentUser.id)
              .maybeSingle();

            if (memberCheck) {
              setUnreadCount((prev) => prev + 1);
            }
          }
        }
      )
      .subscribe();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);

      if (event === "SIGNED_IN") {
        router.refresh();
      }
      if (event === "SIGNED_OUT") {
        setUser(null);
        setAvatarUrl(null);
        setUnreadCount(0);
        router.push("/login");
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
      window.removeEventListener("messages-read", handleMessagesRead);
    };
  }, [router]);

  async function fetchUnreadCount(userId) {
    const { data: userRooms } = await supabase
      .from("direct_room_members")
      .select("room_id")
      .eq("user_id", userId)
      .is("archived_at", null);

    if (!userRooms || userRooms.length === 0) {
      setUnreadCount(0);
      return;
    }
    const roomIds = userRooms.map((r) => r.room_id);

    const { count } = await supabase
      .from("direct_messages")
      .select("*", { count: "exact", head: true })
      .in("room_id", roomIds)
      .neq("sender_id", userId)
      .eq("is_read", false);

    setUnreadCount(count || 0);
  }

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setDropdownOpen(false);
  };

  return (
    <nav className="navigation-surface h-20 border-b border-neutral-200/80 dark:border-neutral-800/80 text-foreground px-6 flex items-center justify-between sticky top-0 z-50 transition-colors">
      <div className="flex items-center space-x-6 flex-1">
        <Link href="/marketplace" className="flex items-center gap-3 shrink-0">
          <div className="relative w-12 h-12">
            <Image
              src="/olfu_logo.png"
              alt="Logo"
              fill
              sizes="48px"
              priority
              className="rounded-full object-contain"
            />
          </div>
          <h1 className="text-xl font-bold hidden lg:block">
            OLFU <span>Marketplace</span>
          </h1>
        </Link>

        <div className="max-w-md w-full ml-4">
          <SearchBar />
        </div>
      </div>

      <div className="flex items-center gap-3 ml-4">
        <ThemeToggle />

        {user && (
          <>
            {/* MESSAGES BUTTON WITH BADGE */}
            <Link
              href="/chat"
              className="p-2.5 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-black/30 dark:border-white/30 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-foreground transition-all relative cursor-pointer"
              title="Messages"
            >
              <MessageSquare size={20} className="text-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            {/* FAVORITES BUTTON */}
            <Link
              href="/favorites"
              className="p-2.5 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-black/30 dark:border-white/30 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-foreground transition-all relative cursor-pointer"
              title="Saved Favorites"
            >
              <Heart size={20} className="text-rose-500 fill-rose-500/20" />
            </Link>
          </>
        )}

        {loading ? (
          <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
        ) : user ? (
          <div className="flex items-center gap-4">
            <Link
              href="/create-listing"
              className="flex items-center gap-2 px-4 py-2 border border-black/30 dark:border-white/30 bg-foreground text-background hover:opacity-90 rounded-lg font-medium transition-all"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Create Listing</span>
            </Link>

            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 p-1 pr-3 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-black/30 dark:border-white/30 transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-neutral-600 flex items-center justify-center text-white font-bold text-sm overflow-hidden shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user.email?.[0].toUpperCase() || "?"
                  )}
                </div>
                <ChevronDown size={16} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)}></div>
                  <div className="absolute right-0 mt-2 w-56 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-20 overflow-hidden py-1">
                    <div className="px-4 py-3 border-b border-neutral-800">
                      <p className="text-sm text-neutral-400">Signed in as</p>
                      <p className="text-sm font-medium text-white truncate">{user.email}</p>
                    </div>

                    <Link href="/profile" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-neutral-800" onClick={() => setDropdownOpen(false)}>
                      <User size={18} />
                      My Profile
                    </Link>

                    <Link href="/chat" className="flex items-center justify-between px-4 py-3 text-sm text-gray-300 hover:bg-neutral-800 border-t border-neutral-800/60" onClick={() => setDropdownOpen(false)}>
                      <div className="flex items-center gap-3">
                        <MessageSquare size={18} className="text-sky-400" />
                        Messages
                      </div>
                      {unreadCount > 0 && (
                        <span className="bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </Link>

                    <Link href="/favorites" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-neutral-800" onClick={() => setDropdownOpen(false)}>
                      <Heart size={18} className="text-rose-500" />
                      Saved Favorites
                    </Link>

                    <Link href="/purchase-history" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-neutral-800" onClick={() => setDropdownOpen(false)}>
                      <ShoppingCart size={18} className="text-yellow-500" />
                      Purchase History
                    </Link>

                    <Link href="/sales-history" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-neutral-800" onClick={() => setDropdownOpen(false)}>
                      <ShoppingBag size={18} className="text-yellow-500" />
                      Sales History
                    </Link>

                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 border-t border-neutral-800 cursor-pointer">
                      <LogOut size={18} />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 font-medium border border-black/30 dark:border-white/30 hover:opacity-80 text-sm font-semibold rounded-lg">Log in</Link>
            <Link href="/register" className="px-4 py-2 bg-foreground text-background hover:opacity-90 text-sm font-semibold rounded-lg">Register</Link>
          </div>
        )}
      </div>
    </nav>
  );
}