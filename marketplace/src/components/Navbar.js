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
import useUnreadCount from "@/lib/useUnreadCount";

// Dropdown colors: explicit light/dark so the menu follows the theme
const MENU_LINE = "border-stone-400 dark:border-neutral-700";
const MENU_ITEM =
  "flex items-center gap-3 px-4 py-3 text-sm text-neutral-800 dark:text-neutral-200 hover:bg-stone-200 dark:hover:bg-neutral-800 transition-colors";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const unreadCount = useUnreadCount();

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
      }

      setLoading(false);
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);

      if (event === "SIGNED_IN") {
        router.refresh();
      }
      if (event === "SIGNED_OUT") {
        setUser(null);
        setAvatarUrl(null);
        router.push("/login");
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);


  const handleLogout = async () => {
    await supabase.auth.signOut();
    setDropdownOpen(false);
  };

  return (
    // Phones (< md): two rows. Row 1 is logo + actions, row 2 is the search bar.
    // md and up: one row, like before.
    <nav className="navigation-surface border-b border-neutral-200/80 dark:border-neutral-800/80 text-foreground px-3 sm:px-6 py-2 md:py-0 md:h-20 flex flex-wrap md:flex-nowrap items-center gap-y-2 sticky top-0 z-50 transition-colors">
      {/* LOGO: the image already includes the "O.L.F.U Marketplace" text,
          so we swap between the light and dark versions by theme. */}
      <Link href="/marketplace" className="order-1 flex items-center shrink-0" aria-label="OLFU Marketplace home">
        <Image
          src="/marketplacelogo_light.png"
          alt="OLFU Marketplace"
          width={400}
          height={100}
          priority
          className="block dark:hidden h-8 min-[360px]:h-9 sm:h-10 md:h-12 lg:h-16 w-auto"
        />
        <Image
          src="/marketplacelogo_dark.png"
          alt="OLFU Marketplace"
          width={400}
          height={100}
          priority
          className="hidden dark:block h-8 min-[360px]:h-9 sm:h-10 md:h-12 lg:h-16 w-auto"
        />
      </Link>

      {/* SEARCH: full-width second row on phones, beside the logo from md up */}
      <div className="order-3 md:order-2 w-full md:w-auto md:flex-1 md:max-w-md md:ml-4 min-w-0">
        <SearchBar />
      </div>

      {/* ACTIONS */}
      <div className="order-2 md:order-3 ml-auto pl-2 md:pl-4 flex items-center gap-2 sm:gap-3 shrink-0">
        <ThemeToggle />

        {user && (
          <>
            {/* MESSAGES BUTTON WITH BADGE (phones use the menu instead, see the dot on the avatar) */}
            <Link
              href="/chat"
              className="hidden sm:inline-flex p-2.5 rounded-full bg-white dark:bg-neutral-900 border border-black dark:border-white hover:bg-neutral-200 dark:hover:bg-neutral-800 text-foreground transition-all relative cursor-pointer"
              title="Messages"
              aria-label="Messages"
            >
              <MessageSquare size={20} className="text-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            {/* FAVORITES BUTTON (phones use the menu instead) */}
            <Link
              href="/favorites"
              className="hidden sm:inline-flex p-2.5 rounded-full bg-white dark:bg-neutral-900 border border-black dark:border-white hover:bg-neutral-200 dark:hover:bg-neutral-800 text-foreground transition-all relative cursor-pointer"
              title="Saved Favorites"
              aria-label="Saved Favorites"
            >
              <Heart size={20} className="text-rose-500 fill-rose-500/20" />
            </Link>
          </>
        )}

        {loading ? (
          <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
        ) : user ? (
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/create-listing"
              aria-label="Create Listing"
              title="Create Listing"
              className="flex items-center gap-2 px-2.5 sm:px-4 py-2 border border-black/30 dark:border-white/30 bg-emerald-700 text-white hover:opacity-90 rounded-lg font-medium transition-all"
            >
              <Plus size={18} />
              {/* text shows on small tablets and desktops; md is icon-only to keep the search bar roomy */}
              <span className="hidden sm:inline md:hidden lg:inline">Create Listing</span>
            </Link>

            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
                className="relative flex items-center gap-1.5 sm:gap-2 p-1 pr-2 sm:pr-3 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-black/30 dark:border-white/30 transition-all cursor-pointer"
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

                {/* Unread dot for phones, where the Messages button is hidden */}
                {unreadCount > 0 && (
                  <span className="sm:hidden absolute -top-0.5 -right-0.5 w-3 h-3 bg-rose-600 rounded-full ring-2 ring-stone-200 dark:ring-neutral-900" />
                )}
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)}></div>
                  <div
                    role="menu"
                    className={`absolute right-0 mt-2 w-60 max-w-[calc(100vw-1.5rem)] bg-stone-100 dark:bg-neutral-900 border ${MENU_LINE} rounded-xl shadow-2xl z-20 overflow-hidden py-1`}
                  >
                    <div className={`px-4 py-3 border-b ${MENU_LINE}`}>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">Signed in as</p>
                      <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{user.email}</p>
                    </div>

                    <Link href="/profile" role="menuitem" className={MENU_ITEM} onClick={() => setDropdownOpen(false)}>
                      <User size={18} />
                      My Profile
                    </Link>

                    <Link href="/chat" role="menuitem" className={`${MENU_ITEM} justify-between`} onClick={() => setDropdownOpen(false)}>
                      <div className="flex items-center gap-3">
                        <MessageSquare size={18} className="text-sky-500 dark:text-sky-400" />
                        Messages
                      </div>
                      {unreadCount > 0 && (
                        <span className="bg-rose-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </Link>

                    <Link href="/favorites" role="menuitem" className={MENU_ITEM} onClick={() => setDropdownOpen(false)}>
                      <Heart size={18} className="text-rose-600" />
                      Saved Favorites
                    </Link>

                    <Link href="/purchase-history" role="menuitem" className={MENU_ITEM} onClick={() => setDropdownOpen(false)}>
                      <ShoppingCart size={18} className="text-yellow-600 dark:text-yellow-500" />
                      Purchase History
                    </Link>

                    <Link href="/sales-history" role="menuitem" className={MENU_ITEM} onClick={() => setDropdownOpen(false)}>
                      <ShoppingBag size={18} className="text-yellow-600 dark:text-yellow-500" />
                      Sales History
                    </Link>

                    <button
                      onClick={handleLogout}
                      role="menuitem"
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-rose-600 dark:text-red-400 hover:bg-red-500/10 border-t ${MENU_LINE} cursor-pointer`}
                    >
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
            <Link href="/login" className="px-4 py-2 border border-black/30 dark:border-white/30 hover:opacity-80 text-sm font-semibold rounded-lg">Log in</Link>
          </div>
        )}
      </div>
    </nav>
  );
}