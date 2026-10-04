"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import useUnreadCount from "@/lib/useUnreadCount";
import {
  Home,
  Tag,
  Clock,
  CalendarClock,
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
  ScrollText,
  Tags,
} from "lucide-react";

// Explicit light/dark colors instead of theme tokens (border-border,
// text-muted-foreground, bg-card...). Those are too light to see against
// stone-200, and `[&_svg]:text-background` turned active icons dark in dark
// mode. Change the values here to restyle the whole sidebar at once.
const LINE = "border-stone-400 dark:border-neutral-700";
const ITEM_BASE = "flex items-center gap-3 py-2.5 rounded-xl text-sm font-semibold transition-all";
const ITEM_ON = "bg-emerald-600 text-white font-bold shadow-sm [&_svg]:text-white";
const ITEM_OFF =
  "text-neutral-700 dark:text-neutral-300 hover:bg-emerald-600 hover:text-white";
const ICON_BTN =
  "p-2 rounded-xl text-neutral-700 dark:text-neutral-300 hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer shrink-0";

// Single nav link. Handles the open/collapsed layouts and the unread badge.
function NavLink({ href, title, label, icon: Icon, active, isOpen, iconClassName = "", badge = 0 }) {
  return (
    <Link
      href={href}
      title={title || label}
      aria-current={active ? "page" : undefined}
      className={`${ITEM_BASE} relative ${active ? ITEM_ON : ITEM_OFF} ${isOpen ? "px-3" : "justify-center w-10 h-10 mx-auto"}`}
    >
      <Icon size={18} className={`shrink-0 ${iconClassName}`} />
      {isOpen && <span className="truncate flex-1">{label}</span>}
      {isOpen && badge > 0 && (
        <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
      {!isOpen && badge > 0 && (
        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-600 rounded-full ring-2 ring-stone-200 dark:ring-neutral-900" />
      )}
    </Link>
  );
}

// Button that opens a group of sub-links (Categories, My Transactions)
function GroupButton({ title, label, icon: Icon, active, isOpen, expanded, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-expanded={isOpen ? expanded : undefined}
      className={`${ITEM_BASE} cursor-pointer ${active
        ? "bg-emerald-600 text-white font-bold [&_svg]:text-white"
        : ITEM_OFF
        } ${isOpen ? "w-full justify-between px-3" : "justify-center w-10 h-10 mx-auto"}`}
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className="shrink-0" />
        {isOpen && <span>{label}</span>}
      </div>
      {isOpen && (
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      )}
    </button>
  );
}

function SubLink({ href, active, children }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${active
        ? "bg-emerald-600 text-white font-bold"
        : "text-neutral-700 dark:text-neutral-300 hover:bg-emerald-600 hover:text-white"
        }`}
    >
      {children}
    </Link>
  );
}

function AdminLink({ href, title, label, icon: Icon, theme, pathname, isOpen }) {
  const active = pathname.startsWith(href);
  return (
    <Link
      href={href}
      title={title}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 py-2.5 rounded-xl text-sm font-semibold transition-all border ${active ? theme.activeLink : theme.inactiveLink
        } ${isOpen ? "px-3" : "justify-center w-10 h-10 mx-auto"}`}
    >
      <Icon size={18} className={`${active ? "text-white" : theme.icon} shrink-0`} />
      {isOpen && <span className="truncate">{label}</span>}
    </Link>
  );
}

function SidebarContent({ isOpen: propIsOpen, toggleSidebar: propToggleSidebar }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isTransactionOpen, setIsTransactionOpen] = useState(
    pathname === "/purchase-history" || pathname === "/sales-history"
  );
  const [role, setRole] = useState(null);
  const [theme, setTheme] = useState("dark");
  const unreadCount = useUnreadCount();

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
    async function loadRole() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .maybeSingle();

          setRole(profile?.role || session.user.app_metadata?.role || "user");
        }
      } catch (err) {
        console.error("Error loading user info:", err);
      }
    }

    loadRole();

    window.addEventListener("user-role-changed", loadRole);
    return () => window.removeEventListener("user-role-changed", loadRole);
  }, []);

  // In the collapsed rail, clicking a group icon expands the sidebar and opens it
  const toggleGroup = (groupOpen, setGroupOpen) => {
    if (!isOpen) {
      toggleSidebar();
      setGroupOpen(true);
    } else {
      setGroupOpen(!groupOpen);
    }
  };

  const allowedAdminRoles = ["super_admin", "superadmin", "admin", "moderator"];
  const isAdminUser = role && allowedAdminRoles.includes(role);

  const categoryGroupActive = pathname.startsWith("/categories") && activeCategory !== "Merchandise";
  const transactionGroupActive = pathname === "/purchase-history" || pathname === "/sales-history";

  return (
    <aside className={`navigation-surface h-full text-neutral-900 dark:text-white border-r ${LINE} flex flex-col justify-between p-3 transition-all duration-300 shrink-0 overflow-x-hidden ${isOpen ? "w-64" : "w-16"}`}>
      <div className="space-y-6 overflow-y-auto overflow-x-hidden">
        {/* BRAND LOGO & COLLAPSE / EXPAND TOGGLE */}
        <div className={`py-2 flex items-center ${isOpen ? "px-1 justify-between" : "justify-center"}`}>
          {isOpen ? (
            <>
              <Link
                href="/marketplace"
                className="text-xl font-black uppercase tracking-wider italic text-neutral-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors truncate"
              >
                Marketplace
              </Link>
              <button
                onClick={toggleSidebar}
                type="button"
                className={ICON_BTN}
                title="Collapse Sidebar"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose size={18} />
              </button>
            </>
          ) : (
            <button
              onClick={toggleSidebar}
              type="button"
              className={`${ICON_BTN} flex items-center justify-center w-10 h-10 bg-stone-100 dark:bg-neutral-800 border ${LINE} shadow-sm mx-auto`}
              title="Expand Sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen size={20} />
            </button>
          )}
        </div>

        {/* NAVIGATION LINKS */}
        <nav className="space-y-1">
          <NavLink href="/marketplace" label="Home" icon={Home} active={isActive("/marketplace")} isOpen={isOpen} />
          <NavLink href="/recent" label="Recent Listings" icon={Clock} active={isActive("/recent")} isOpen={isOpen} />
          <NavLink href="/rentals" label="Rentals" icon={CalendarClock} active={pathname.startsWith("/rentals")} isOpen={isOpen} />

          {/* CATEGORIES DROPDOWN */}
          <div className="space-y-1">
            <GroupButton
              title="Categories"
              label="Categories"
              icon={Tag}
              active={categoryGroupActive}
              isOpen={isOpen}
              expanded={isCategoryOpen}
              onClick={() => toggleGroup(isCategoryOpen, setIsCategoryOpen)}
            />

            {isOpen && isCategoryOpen && (
              <div className="pl-9 pr-2 space-y-1 animate-in slide-in-from-top-1 duration-150">
                <SubLink href="/categories" active={pathname === "/categories" && !activeCategory}>
                  All Categories & Tags
                </SubLink>
                <SubLink href="/categories?category=Textbooks" active={activeCategory === "Textbooks"}>
                  📚 Textbooks
                </SubLink>
                <SubLink href="/categories?category=Electronics" active={activeCategory === "Electronics"}>
                  💻 Electronics
                </SubLink>
                <SubLink href="/categories?category=Uniforms" active={activeCategory === "Uniforms"}>
                  👕 Uniforms
                </SubLink>
              </div>
            )}
          </div>

          <NavLink
            href="/merchandise"
            label="Merchandise"
            icon={ShoppingBag}
            iconClassName="text-amber-500"
            active={pathname.startsWith("/merchandise") || activeCategory === "Merchandise"}
            isOpen={isOpen}
          />

          {/* MESSAGES LINK WITH BADGE */}
          <NavLink
            href="/chat"
            label="Messages"
            icon={MessageSquare}
            active={pathname.startsWith("/chat")}
            isOpen={isOpen}
            badge={unreadCount}
          />

          <NavLink href="/ai-chat" title="AI Support" label="AI Support" icon={Bot} active={isActive("/ai-chat")} isOpen={isOpen} />
          <NavLink href="/mylistings" label="My Listings" icon={ListOrdered} active={isActive("/mylistings")} isOpen={isOpen} />

          {/* TRANSACTIONS DROPDOWN MENU */}
          <div className="space-y-1">
            <GroupButton
              title="My Transactions"
              label="My Transactions"
              icon={History}
              active={transactionGroupActive}
              isOpen={isOpen}
              expanded={isTransactionOpen}
              onClick={() => toggleGroup(isTransactionOpen, setIsTransactionOpen)}
            />

            {/* COLLAPSIBLE TRANSACTION ITEMS */}
            {isOpen && isTransactionOpen && (
              <div className="pl-9 pr-2 space-y-1 animate-in slide-in-from-top-1 duration-150">
                <SubLink href="/purchase-history" active={pathname === "/purchase-history"}>
                  <ShoppingCart size={14} className="shrink-0" />
                  <span>Purchase History</span>
                </SubLink>
                <SubLink href="/sales-history" active={pathname === "/sales-history"}>
                  <ShoppingBag size={14} className="shrink-0" />
                  <span>Sales History</span>
                </SubLink>
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

          const adminProps = { theme: themeConfig, pathname, isOpen };

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

              <AdminLink href="/admin/organizations" title="Org Applications" label="Org Applications" icon={Building2} {...adminProps} />
              <AdminLink href="/admin/merch-approvals" title="Merch Approvals" label="Merch Approvals" icon={ShieldCheck} {...adminProps} />
              <AdminLink href="/admin/reports" title="Reports" label="Reports" icon={ShieldAlert} {...adminProps} />
              <AdminLink href="/admin/flagged" title="Flagged Content" label="Flagged Content" icon={Flag} {...adminProps} />
              <AdminLink href="/admin/categories" title="Categories & Tags" label="Categories & Tags" icon={Tags} {...adminProps} />

              {!isMod && (
                <>
                  <AdminLink href="/admin/analytics" title="Analytics" label="Analytics" icon={TrendingUp} {...adminProps} />
                  <AdminLink href="/admin/users" title="Users Management" label="Users Management" icon={Users} {...adminProps} />
                </>
              )}

              {isSuper && (
                <AdminLink href="/admin/audit-logs" title="Audit Logs" label="Audit Logs" icon={ScrollText} {...adminProps} />
              )}
            </div>
          );
        })()}
      </div>

      {/* BOTTOM CONTROLS & THEME TOGGLE */}
      <div className={`pt-4 border-t ${LINE} space-y-2 shrink-0`}>
        <button
          onClick={toggleTheme}
          type="button"
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className={`flex items-center justify-center w-full py-2.5 rounded-xl text-sm font-semibold transition-all text-neutral-700 dark:text-neutral-300 hover:bg-stone-300 dark:hover:bg-neutral-800 border ${LINE} cursor-pointer ${isOpen ? "px-3 gap-3" : "w-10 h-10 mx-auto"
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
          className={`flex items-center justify-center gap-2 w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-black border border-emerald-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors active:scale-95 shadow-sm ${isOpen ? "px-3" : "w-10 h-10 mx-auto"
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