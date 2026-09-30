"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  Home,
  Tag,
  Clock,
  MessageSquare,
  ListOrdered,
  PlusCircle,
  Bot,
  ChevronDown,
  ShoppingBag,
  ShieldAlert,
  Users,
  Shield,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  History,
  ShoppingCart,
  TrendingUp,
  Building2,
  ShieldCheck,
  Flag,
} from "lucide-react";

function SidebarContent({ isOpen: propIsOpen, toggleSidebar: propToggleSidebar }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isTransactionOpen, setIsTransactionOpen] = useState(
    pathname === "/purchase-history" || pathname === "/sales-history"
  );
  const [role, setRole] = useState(null);
  const [theme, setTheme] = useState("dark");
  const [unreadCount, setUnreadCount] = useState(0);

  const [internalIsOpen, setInternalIsOpen] = useState(true);
  const isOpen = propIsOpen !== undefined ? propIsOpen : internalIsOpen;
  const toggleSidebar = propToggleSidebar || (() => setInternalIsOpen((prev) => !prev));

  const activeCategory = searchParams.get("category");
  const isActive = (path) => pathname === path && !activeCategory;

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "dark";
    setTheme(savedTheme);
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);

    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  useEffect(() => {
    async function checkRoleAndMessages() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .maybeSingle();

          const userRole =
            profile?.role || session.user.app_metadata?.role || "user";
          setRole(userRole);

          // Fetch unread count for sidebar
          fetchUnreadCount(session.user.id);
        }
      } catch (err) {
        console.error("Error loading user info:", err);
      }
    }

    checkRoleAndMessages();

    // 👉 Auto-clear badge instantly when messages are read in ChatRoom
    const handleMessagesRead = () => {
      setUnreadCount(0);
    };
    window.addEventListener("messages-read", handleMessagesRead);

    // Realtime listener for sidebar badge updates
    const channel = supabase
      .channel("sidebar-unread-count")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        async (payload) => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user) return;

          if (payload.new.sender_id !== session.user.id) {
            const { data: memberCheck } = await supabase
              .from("direct_room_members")
              .select("room_id")
              .eq("room_id", payload.new.room_id)
              .eq("user_id", session.user.id)
              .maybeSingle();

            if (memberCheck) {
              setUnreadCount((prev) => prev + 1);
            }
          }
        }
      )
      .subscribe();

    const handleRoleUpdate = () => {
      checkRoleAndMessages();
    };

    window.addEventListener("user-role-changed", handleRoleUpdate);
    return () => {
      window.removeEventListener("user-role-changed", handleRoleUpdate);
      window.removeEventListener("messages-read", handleMessagesRead);
      supabase.removeChannel(channel);
    };
  }, []);

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

  const allowedAdminRoles = ["super_admin", "superadmin", "admin", "moderator"];
  const isAdminUser = role && allowedAdminRoles.includes(role);

  return (
    <aside className={`navigation-surface h-full text-foreground border-r border-border flex flex-col justify-between p-3 transition-all duration-300 shrink-0 overflow-x-hidden ${isOpen ? "w-64" : "w-16"}`}>
      <div className="space-y-6 overflow-y-auto overflow-x-hidden">
        {/* BRAND LOGO & COLLAPSE / EXPAND TOGGLE */}
        <div className={`py-2 flex items-center ${isOpen ? "px-1 justify-between" : "justify-center"}`}>
          {isOpen ? (
            <>
              <h2 className="text-xl font-black uppercase tracking-wider italic text-foreground hover:text-foreground dark:hover:text-white transition-colors cursor-pointer truncate">
                Marketplace
              </h2>
              <button
                onClick={toggleSidebar}
                type="button"
                className="p-2 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground dark:hover:text-white transition-colors cursor-pointer shrink-0"
                title="Collapse Sidebar"
              >
                <PanelLeftClose size={18} />
              </button>
            </>
          ) : (
            <button
              onClick={toggleSidebar}
              type="button"
              className="p-2 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground dark:hover:text-white transition-colors cursor-pointer flex items-center justify-center w-10 h-10 bg-card border border-border shadow-sm mx-auto"
              title="Expand Sidebar"
            >
              <PanelLeftOpen size={20} />
            </button>
          )}
        </div>

        {/* NAVIGATION LINKS */}
        <nav className="space-y-1">
          <Link
            href="/marketplace"
            title="Home"
            className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive("/marketplace")
              ? "bg-foreground text-background font-bold shadow-sm [&_svg]:text-background dark:[&_svg]:text-background"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
              } ${isOpen ? "px-3" : "justify-center w-10 h-10 mx-auto"}`}
          >
            <Home size={18} className="shrink-0" />
            {isOpen && <span className="truncate">Home</span>}
          </Link>

          <Link
            href="/recent"
            title="Recent Listings"
            className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive("/recent")
              ? "bg-foreground text-background font-bold shadow-sm [&_svg]:text-background dark:[&_svg]:text-background"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
              } ${isOpen ? "px-3" : "justify-center w-10 h-10 mx-auto"}`}
          >
            <Clock size={18} className="shrink-0" />
            {isOpen && <span className="truncate">Recent Listings</span>}
          </Link>

          {/* CATEGORIES DROPDOWN */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => isOpen && setIsCategoryOpen(!isCategoryOpen)}
              title="Categories"
              className={`w-full flex items-center justify-between py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${pathname.startsWith("/categories") && activeCategory !== "Merchandise"
                ? "text-foreground font-bold [&_svg]:text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                } ${isOpen ? "px-3" : "justify-center w-10 h-10 mx-auto"}`}
            >
              <div className="flex items-center gap-3">
                <Tag size={18} className="shrink-0" />
                {isOpen && <span>Categories</span>}
              </div>
              {isOpen && (
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${isCategoryOpen ? "rotate-180" : ""
                    }`}
                />
              )}
            </button>

            {isOpen && isCategoryOpen && (
              <div className="pl-9 pr-2 space-y-1 animate-in slide-in-from-top-1 duration-150">
                <Link
                  href="/categories"
                  className={`block px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${pathname === "/categories" && !activeCategory
                    ? "bg-accent text-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    }`}
                >
                  All Categories & Tags
                </Link>

                <Link
                  href="/categories?category=Textbooks"
                  className={`block px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${activeCategory === "Textbooks"
                    ? "bg-accent text-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    }`}
                >
                  📚 Textbooks
                </Link>
                <Link
                  href="/categories?category=Electronics"
                  className={`block px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${activeCategory === "Electronics"
                    ? "bg-accent text-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    }`}
                >
                  💻 Electronics
                </Link>
                <Link
                  href="/categories?category=Uniforms"
                  className={`block px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${activeCategory === "Uniforms"
                    ? "bg-accent text-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    }`}
                >
                  👕 Uniforms
                </Link>
              </div>
            )}
          </div>

          <Link
            href="/merchandise"
            title="Merchandise"
            className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeCategory === "Merchandise"
              ? "bg-foreground text-background font-bold shadow-sm [&_svg]:text-background dark:[&_svg]:text-background"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
              } ${isOpen ? "px-3" : "justify-center w-10 h-10 mx-auto"}`}
          >
            <ShoppingBag size={18} className="shrink-0 text-amber-500" />
            {isOpen && <span className="truncate">Merchandise</span>}
          </Link>

          {/* MESSAGES LINK WITH BADGE */}
          <Link
            href="/chat"
            title="Messages"
            className={`flex items-center justify-between py-2.5 rounded-xl text-sm font-semibold transition-all relative ${isActive("/chat")
              ? "bg-foreground text-background font-bold shadow-sm [&_svg]:text-background dark:[&_svg]:text-background"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
              } ${isOpen ? "px-3" : "justify-center w-10 h-10 mx-auto"}`}
          >
            <div className="flex items-center gap-3">
              <MessageSquare size={18} className="shrink-0" />
              {isOpen && <span className="truncate">Messages</span>}
            </div>
            {isOpen && unreadCount > 0 && (
              <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
            {!isOpen && unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-600 rounded-full ring-2 ring-card" />
            )}
          </Link>

          <Link
            href="/ai-chat"
            title="AI Support"
            className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive("/ai-chat")
              ? "bg-foreground text-background font-bold shadow-sm [&_svg]:text-background dark:[&_svg]:text-background"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
              } ${isOpen ? "px-3" : "justify-center w-10 h-10 mx-auto"}`}
          >
            <Bot size={18} className="shrink-0" />
            {isOpen && <span className="truncate">AI Support</span>}
          </Link>

          <Link
            href="/mylistings"
            title="My Listings"
            className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive("/mylistings")
              ? "bg-foreground text-background font-bold shadow-sm [&_svg]:text-background dark:[&_svg]:text-background"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
              } ${isOpen ? "px-3" : "justify-center w-10 h-10 mx-auto"}`}
          >
            <ListOrdered size={18} className="shrink-0" />
            {isOpen && <span className="truncate">My Listings</span>}
          </Link>

          {/* TRANSACTIONS DROPDOWN MENU */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => isOpen && setIsTransactionOpen(!isTransactionOpen)}
              title="My Transactions"
              className={`w-full flex items-center justify-between py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${pathname === "/purchase-history" || pathname === "/sales-history"
                ? "text-foreground font-bold [&_svg]:text-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                } ${isOpen ? "px-3" : "justify-center w-10 h-10 mx-auto"}`}
            >
              <div className="flex items-center gap-3">
                <History size={18} className="shrink-0" />
                {isOpen && <span>My Transactions</span>}
              </div>
              {isOpen && (
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${isTransactionOpen ? "rotate-180" : ""
                    }`}
                />
              )}
            </button>

            {/* COLLAPSIBLE TRANSACTION ITEMS */}
            {isOpen && isTransactionOpen && (
              <div className="pl-9 pr-2 space-y-1 animate-in slide-in-from-top-1 duration-150">
                <Link
                  href="/purchase-history"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${pathname === "/purchase-history"
                    ? "bg-accent text-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    }`}
                >
                  <ShoppingCart size={14} className="shrink-0" />
                  <span>Purchase History</span>
                </Link>
                <Link
                  href="/sales-history"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${pathname === "/sales-history"
                    ? "bg-accent text-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                    }`}
                >
                  <ShoppingBag size={14} className="shrink-0" />
                  <span>Sales History</span>
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* DYNAMIC ROLE ADMIN SECTION */}
        {isAdminUser && (() => {
          const isSuper = role === "super_admin" || role === "superadmin";
          const isAdmin = role === "admin";
          const isMod = role === "moderator";

          const themeConfig = isSuper
            ? {
              border: "border-purple-300 dark:border-purple-800/40",
              text: "text-purple-700 dark:text-purple-400",
              badgeBg:
                "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
              activeLink:
                "bg-purple-600 text-white shadow-md shadow-purple-900/20 font-bold [&_svg]:text-white",
              inactiveLink:
                "bg-purple-50/80 text-purple-900 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/30 dark:text-purple-200 dark:border-purple-900/40 dark:hover:bg-purple-900/50",
              icon: "text-purple-600 dark:text-purple-400",
              label: "Superadmin Mode",
            }
            : isAdmin
              ? {
                border: "border-blue-300 dark:border-blue-800/40",
                text: "text-blue-700 dark:text-blue-400",
                badgeBg:
                  "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
                activeLink:
                  "bg-blue-600 text-white shadow-md shadow-blue-900/20 font-bold [&_svg]:text-white",
                inactiveLink:
                  "bg-blue-50/80 text-blue-900 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-200 dark:border-blue-900/40 dark:hover:bg-blue-900/50",
                icon: "text-blue-600 dark:text-blue-400",
                label: "Admin Mode",
              }
              : {
                border: "border-emerald-300 dark:border-emerald-800/40",
                text: "text-emerald-700 dark:text-emerald-400",
                badgeBg:
                  "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
                activeLink:
                  "bg-emerald-600 text-white shadow-md shadow-emerald-900/20 font-bold [&_svg]:text-white",
                inactiveLink:
                  "bg-emerald-50/80 text-emerald-900 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900/40 dark:hover:bg-emerald-900/50",
                icon: "text-emerald-600 dark:text-emerald-400",
                label: "Moderator Mode",
              };

          return (
            <div
              className={`pt-4 border-t space-y-1 animate-in fade-in duration-200 ${themeConfig.border}`}
            >
              {isOpen && (
                <div className="flex items-center justify-between px-3 mb-2">
                  <span
                    className={`text-[10px] font-black tracking-widest uppercase flex items-center gap-1 ${themeConfig.text}`}
                  >
                    <Shield size={12} /> {themeConfig.label}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 text-[9px] font-bold border rounded-md ${themeConfig.badgeBg}`}
                  >
                    ACTIVE
                  </span>
                </div>
              )}

              <Link
                href="/admin/organizations"
                title="Org Applications"
                className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-semibold transition-all border ${pathname.startsWith("/admin/organizations")
                  ? themeConfig.activeLink
                  : themeConfig.inactiveLink
                  } ${isOpen ? "px-3" : "justify-center w-10 h-10 mx-auto"}`}
              >
                <Building2 size={18} className={`${pathname.startsWith("/admin/organizations") ? "text-white" : themeConfig.icon} shrink-0`} />
                {isOpen && <span className="truncate">Org Applications</span>}
              </Link>

              <Link
                href="/admin/merch-approvals"
                title="Merch Approvals"
                className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-semibold transition-all border ${pathname.startsWith("/admin/merch-approvals")
                  ? themeConfig.activeLink
                  : themeConfig.inactiveLink
                  } ${isOpen ? "px-3" : "justify-center w-10 h-10 mx-auto"}`}
              >
                <ShieldCheck size={18} className={`${pathname.startsWith("/admin/merch-approvals") ? "text-white" : themeConfig.icon} shrink-0`} />
                {isOpen && <span className="truncate">Merch Approvals</span>}
              </Link>

              <Link
                href="/admin/reports"
                title="Reports"
                className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-semibold transition-all border ${pathname.startsWith("/admin/reports")
                  ? themeConfig.activeLink
                  : themeConfig.inactiveLink
                  } ${isOpen ? "px-3" : "justify-center w-10 h-10 mx-auto"}`}
              >
                <ShieldAlert size={18} className={`${pathname.startsWith("/admin/reports") ? "text-white" : themeConfig.icon} shrink-0`} />
                {isOpen && <span className="truncate">Reports</span>}
              </Link>

              <Link
                href="/admin/flagged"
                title="Flagged Content"
                className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-semibold transition-all border ${pathname.startsWith("/admin/flagged")
                  ? themeConfig.activeLink
                  : themeConfig.inactiveLink
                  } ${isOpen ? "px-3" : "justify-center w-10 h-10 mx-auto"}`}
              >
                <Flag size={18} className={`${pathname.startsWith("/admin/flagged") ? "text-white" : themeConfig.icon} shrink-0`} />
                {isOpen && <span className="truncate">Flagged Content</span>}
              </Link>

              <Link
                href="/admin/analytics"
                title="Analytics"
                className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-semibold transition-all border ${pathname.startsWith("/admin/analytics")
                  ? themeConfig.activeLink
                  : themeConfig.inactiveLink
                  } ${isOpen ? "px-3" : "justify-center w-10 h-10 mx-auto"}`}
              >
                <TrendingUp size={18} className={`${pathname.startsWith("/admin/analytics") ? "text-white" : themeConfig.icon} shrink-0`} />
                {isOpen && <span className="truncate">Analytics</span>}
              </Link>

              {!isMod && (
                <Link
                  href="/admin/users"
                  title="Users Management"
                  className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-semibold transition-all border ${pathname.startsWith("/admin/users")
                    ? themeConfig.activeLink
                    : themeConfig.inactiveLink
                    } ${isOpen ? "px-3" : "justify-center w-10 h-10 mx-auto"}`}
                >
                  <Users size={18} className={`${pathname.startsWith("/admin/users") ? "text-white" : themeConfig.icon} shrink-0`} />
                  {isOpen && <span className="truncate">Users Management</span>}
                </Link>
              )}
            </div>
          );
        })()}
      </div>

      {/* BOTTOM CONTROLS & THEME TOGGLE */}
      <div className="pt-4 border-t border-border space-y-2 shrink-0">
        <button
          onClick={toggleTheme}
          type="button"
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className={`flex items-center justify-center w-full py-2.5 rounded-xl text-sm font-semibold transition-all text-muted-foreground hover:bg-accent hover:text-foreground border border-border cursor-pointer ${isOpen ? "px-3 gap-3" : "w-10 h-10 mx-auto"
            }`}
        >
          {theme === "dark" ? (
            <Sun size={18} className="text-amber-400 shrink-0" />
          ) : (
            <Moon size={18} className="text-indigo-600 shrink-0" />
          )}
          {isOpen && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </button>

        <Link
          href="/create-listing"
          title="Create Listing"
          className={`flex items-center justify-center gap-2 w-full py-3 bg-foreground text-background font-bold text-xs uppercase tracking-wider rounded-xl hover:opacity-90 transition-opacity active:scale-95 shadow-sm ${isOpen ? "px-3" : "w-10 h-10 mx-auto"
            }`}
        >
          <PlusCircle size={16} className="shrink-0" />
          {isOpen && <span className="truncate">Create Listing</span>}
        </Link>
      </div>
    </aside>
  );
}

export default function Sidebar(props) {
  return (
    <Suspense fallback={null}>
      <SidebarContent {...props} />
    </Suspense>
  );
}