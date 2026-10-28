"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    Bell,
    CheckCheck,
    Loader2,
    Flag,
    ShoppingBag,
    Tag,
    CreditCard,
    CheckCircle2,
    AlertTriangle,
    ShieldCheck,
    MoreHorizontal,
    Archive,
    ArchiveRestore,
    Trash2,
    Mail,
    MailOpen,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

// How many notifications load at a time. More load automatically as you scroll down.
const PAGE_SIZE = 20;

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Shown in the payment popup. Change these if the admin account changes.
const GCASH_ACCOUNT_NAME = "OLFU Marketplace Admin";
const PAYMENT_EMAIL = "olfumarketplace@gmail.com";

// How close (in time) a payment notification and a product must be to be matched
const PAYMENT_MATCH_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours

// Archived ids are remembered in this browser (shared with the notification bell)
const archiveKey = (uid) => `notifications:archived:${uid}`;

// A merch drop counts as approved once its status is anything other than these
// (it stays "pending" while waiting for payment/approval). Edit if your statuses differ.
const NOT_APPROVED_STATUSES = ["pending", "flagged", "rejected", "removed", "deleted"];
const isApprovedStatus = (status) =>
    !!status && !NOT_APPROVED_STATUSES.includes(String(status).toLowerCase());

// Fallback icon when a notification has no photo
const pickIcon = (title = "") => {
    const t = title.toLowerCase();
    if (t.includes("report")) return Flag;
    if (t.includes("merch")) return ShoppingBag;
    if (t.includes("listing")) return Tag;
    return Bell;
};

// Admin-only notifications. Edit this list if your admin titles change.
const ADMIN_PATTERNS = /needs review|report to review|awaiting approval|org application|new application|flagged/i;
const isAdminNotif = (n) =>
    n.type === "admin" || n.audience === "admin" || ADMIN_PATTERNS.test(n.title || "");

// Each kind of admin notification gets its own icon, color and group heading.
const ADMIN_KINDS = {
    report: {
        label: "Report",
        group: "Reports",
        Icon: Flag,
        iconBox: "bg-rose-500/15 text-rose-500 dark:text-rose-400",
        text: "text-rose-500 dark:text-rose-400",
        dot: "bg-rose-500",
        chip: "bg-rose-500/15 text-rose-500 dark:text-rose-400",
    },
    flagged: {
        label: "Flagged",
        group: "Flagged listings",
        Icon: AlertTriangle,
        iconBox: "bg-amber-500/15 text-amber-500 dark:text-amber-400",
        text: "text-amber-500 dark:text-amber-400",
        dot: "bg-amber-500",
        chip: "bg-amber-500/15 text-amber-500 dark:text-amber-400",
    },
    merch: {
        label: "Merch approval",
        group: "Merch awaiting approval",
        Icon: ShoppingBag,
        iconBox: "bg-purple-500/15 text-purple-500 dark:text-purple-400",
        text: "text-purple-500 dark:text-purple-400",
        dot: "bg-purple-500",
        chip: "bg-purple-500/15 text-purple-500 dark:text-purple-400",
    },
    other: {
        label: "Admin",
        group: "Other",
        Icon: ShieldCheck,
        iconBox: "bg-sky-500/15 text-sky-500 dark:text-sky-400",
        text: "text-sky-500 dark:text-sky-400",
        dot: "bg-sky-500",
        chip: "bg-sky-500/15 text-sky-500 dark:text-sky-400",
    },
};
const ADMIN_KIND_ORDER = ["report", "flagged", "merch", "other"];
const adminKind = (n) => {
    const t = n.title || "";
    if (/report to review/i.test(t)) return "report";
    if (/needs review|flagged/i.test(t)) return "flagged";
    if (/awaiting approval/i.test(t)) return "merch";
    return "other";
};

// What happened to a listing once it left "pending"/"flagged": "Approved", "Rejected" or "Removed".
const outcomeOf = (status) => {
    const st = String(status || "").toLowerCase();
    if (st === "rejected") return "Rejected";
    if (st === "removed" || st === "deleted") return "Removed";
    return isApprovedStatus(st) ? "Approved" : "Resolved";
};

// Title shown on an admin notification once it has been handled
const resolvedTitle = (n, state) => {
    const kind = adminKind(n);
    const word = (state?.label || "Resolved").toLowerCase();
    if (kind === "report") return "Report resolved";
    if (kind === "flagged") return `Flagged listing ${word}`;
    if (kind === "merch") return `Merch listing ${word}`;
    return n.title;
};

// "Payment needed for your merch drop" opens the payment popup instead of a page.
const isPaymentNotif = (n) =>
    !isAdminNotif(n) &&
    /payment/i.test(n.title || "") &&
    /merch/i.test(`${n.title || ""} ${n.body || ""}`);

// Pulls the fee and GCash number out of the notification text,
// e.g. "Send your payment of ₱32.00 to GCash number 09277549105, ..."
const parsePayment = (n) => {
    const body = n.body || "";
    const amountMatch = body.match(/₱\s*([\d,]+(?:\.\d+)?)/);
    const numberMatch = body.match(/\b(09\d{9}|\+?63\d{10})\b/);
    const raw = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : null;
    return {
        amount:
            raw !== null && !Number.isNaN(raw)
                ? `₱${raw.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : null,
        number: numberMatch ? numberMatch[1] : null,
    };
};

// Same staff roles your admin code uses (profiles.role). Comparison ignores case, spaces, dashes and underscores.
const norm = (v) => String(v ?? "").toLowerCase().replace(/[^a-z]/g, "");
const STAFF_ROLES = ["moderator", "admin", "superadmin"];
const hasAdminAccess = (profile) => !!profile && STAFF_ROLES.includes(norm(profile.role));

const notifyChanged = () => window.dispatchEvent(new Event("notifications:changed"));

function timeAgo(iso) {
    const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

// Looks up the product behind each notification (photo, title, status) and works out
// whether admin notifications are still pending or already handled.
async function enrichNotifications(data, uid, reportsSeen) {
    const titleOf = (n) => (n.body || "").split(" - Reason:")[0].trim();

    // Product id in the link, else the title in the body
    const idByNotif = {};
    data.forEach((n) => {
        const m = n.link?.match(UUID_RE);
        if (m) idByNotif[n.id] = m[0];
    });

    const byId = {};
    const idList = [...new Set(Object.values(idByNotif))];
    if (idList.length > 0) {
        const { data: prods } = await supabase
            .from("products")
            .select("id, title, status, image_urls")
            .in("id", idList);
        (prods || []).forEach((pr) => (byId[pr.id] = pr));
    }

    const byTitle = {};
    const titles = [
        ...new Set(
            data
                .filter((n) => !byId[idByNotif[n.id]] && titleOf(n) && /listing|merch/i.test(n.title || ""))
                .map(titleOf)
        ),
    ];
    if (titles.length > 0) {
        const { data: rows } = await supabase
            .from("products")
            .select("id, title, status, image_urls, created_at, seller_id")
            .in("title", titles)
            .order("created_at", { ascending: false });
        (rows || []).forEach((pr) => {
            const cur = byTitle[pr.title];
            // newest match wins, but a listing that belongs to this user beats someone else's
            if (!cur || (pr.seller_id === uid && cur.seller_id !== uid)) byTitle[pr.title] = pr;
        });
    }

    // Payment notifications have no product link or title, so match them to
    // this user's product that was created closest to the notification time
    const byTime = {};
    const unmatchedPayments = data.filter(
        (n) => isPaymentNotif(n) && !byId[idByNotif[n.id]] && !byTitle[titleOf(n)]
    );
    if (unmatchedPayments.length > 0) {
        const { data: mine } = await supabase
            .from("products")
            .select("id, title, status, image_urls, created_at")
            .eq("seller_id", uid)
            .order("created_at", { ascending: false })
            .limit(50);
        unmatchedPayments.forEach((n) => {
            const t = new Date(n.created_at).getTime();
            let best = null;
            let bestDiff = Infinity;
            (mine || []).forEach((pr) => {
                const diff = Math.abs(new Date(pr.created_at).getTime() - t);
                if (diff < bestDiff) {
                    best = pr;
                    bestDiff = diff;
                }
            });
            if (best && bestDiff < PAYMENT_MATCH_WINDOW_MS) byTime[n.id] = best;
        });
    }

    const productOf = (n) => byId[idByNotif[n.id]] || byTitle[titleOf(n)] || byTime[n.id] || null;

    // Pending or handled for each admin notification
    const done = new Set();
    const adminState = {};
    data.forEach((n) => {
        if (!isAdminNotif(n)) return;
        adminState[n.id] = { resolved: false, label: "Pending" };
        const kind = adminKind(n);
        const pr = productOf(n);
        // Flagged listing: waiting while product.status is "flagged"
        // Merch drop: waiting while product.status is "pending"
        const waitingStatus = kind === "flagged" ? "flagged" : kind === "merch" ? "pending" : null;
        if (waitingStatus && pr && pr.status !== waitingStatus) {
            adminState[n.id] = { resolved: true, label: outcomeOf(pr.status) };
            done.add(n.id);
        }
    });

    // Reports: as many "New report to review" notifications as there are pending reports stay pending,
    // the older ones are resolved
    const reportNotifs = data.filter((n) => isAdminNotif(n) && adminKind(n) === "report");
    if (reportNotifs.length > 0) {
        const { count: pendingCount, error: countError } = await supabase
            .from("reports")
            .select("id", { count: "exact", head: true })
            .or("status.eq.pending,status.is.null");
        if (!countError && pendingCount !== null) {
            reportNotifs.forEach((n, idx) => {
                if (reportsSeen + idx < pendingCount) return; // list is newest first
                adminState[n.id] = { resolved: true, label: "Resolved" };
                done.add(n.id);
            });
        }
    }

    const images = {};
    const productIds = {};
    const productTitles = {};
    const productStatuses = {};
    data.forEach((n) => {
        const pr = productOf(n);
        const url = n.image_url || pr?.image_urls?.[0];
        if (url) images[n.id] = url;
        if (pr?.id) productIds[n.id] = pr.id;
        if (pr?.title) productTitles[n.id] = pr.title;
        if (pr?.status) productStatuses[n.id] = pr.status;
    });

    return { images, productIds, productTitles, productStatuses, adminState, done };
}

export default function NotificationsPage() {
    const router = useRouter();
    const [userId, setUserId] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [emailOn, setEmailOn] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false); // fails closed: false until verified
    const [tab, setTab] = useState("all");
    const [images, setImages] = useState({}); // notification id -> photo url
    const [productIds, setProductIds] = useState({}); // notification id -> product id
    const [productTitles, setProductTitles] = useState({}); // notification id -> product title
    const [productStatuses, setProductStatuses] = useState({}); // notification id -> product status
    const [adminStates, setAdminStates] = useState({}); // admin notification id -> { resolved, label }
    const [archived, setArchived] = useState(() => new Set()); // archived notification ids (saved in this browser)
    const [menuId, setMenuId] = useState(null); // notification whose 3-dot menu is open
    const [payment, setPayment] = useState(null); // { amount, number, title, approved } while the payment popup is open

    const offsetRef = useRef(0); // how many rows were fetched so far
    const reportSeenRef = useRef(0); // report notifications seen on earlier pages
    const loadingRef = useRef(false);
    const sentinelRef = useRef(null);

    // Loads the newest page (append = false) or the next older page (append = true)
    const loadPage = useCallback(async (uid, append) => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        if (append) setLoadingMore(true);
        else {
            offsetRef.current = 0;
            reportSeenRef.current = 0;
        }
        const from = offsetRef.current;

        const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);

        if (error) {
            toast.error("Couldn't load notifications.");
        } else {
            offsetRef.current = from + data.length;
            setHasMore(data.length === PAGE_SIZE);

            const info = await enrichNotifications(data, uid, reportSeenRef.current);
            reportSeenRef.current += data.filter((n) => isAdminNotif(n) && adminKind(n) === "report").length;

            // Handled admin notifications are marked as read, so the red badge stops counting them
            const now = new Date().toISOString();
            const staleUnread = data.filter((n) => info.done.has(n.id) && !n.read_at).map((n) => n.id);
            const rows = data.map((n) => (staleUnread.includes(n.id) ? { ...n, read_at: now } : n));
            if (staleUnread.length > 0) {
                await supabase.from("notifications").update({ read_at: now }).in("id", staleUnread);
                notifyChanged();
            }

            setItems((prev) => {
                if (!append) return rows;
                const seen = new Set(prev.map((i) => i.id));
                return [...prev, ...rows.filter((i) => !seen.has(i.id))];
            });
            const merge = (setter, next) => setter((prev) => (append ? { ...prev, ...next } : next));
            merge(setImages, info.images);
            merge(setProductIds, info.productIds);
            merge(setProductTitles, info.productTitles);
            merge(setProductStatuses, info.productStatuses);
            merge(setAdminStates, info.adminState);
        }

        loadingRef.current = false;
        setLoadingMore(false);
    }, []);

    // First load: who is signed in, their role, email preference, first page, archived ids
    useEffect(() => {
        (async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                router.replace("/login");
                return;
            }
            setUserId(user.id);

            try {
                const raw = localStorage.getItem(archiveKey(user.id));
                setArchived(new Set(raw ? JSON.parse(raw) : []));
            } catch {
                setArchived(new Set());
            }

            const [, prefs, profile] = await Promise.all([
                loadPage(user.id, false),
                supabase.from("notification_prefs").select("email_enabled").eq("user_id", user.id).maybeSingle(),
                supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
            ]);
            if (prefs.data) setEmailOn(prefs.data.email_enabled);
            setIsAdmin(!profile.error && hasAdminAccess(profile.data));
            setLoading(false);
        })();
    }, [loadPage, router]);

    // Load older notifications automatically when you scroll to the bottom of the list
    useEffect(() => {
        if (!hasMore || loading || !userId || !sentinelRef.current) return;
        const el = sentinelRef.current;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !loadingRef.current) loadPage(userId, true);
            },
            { rootMargin: "300px" }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [hasMore, loading, userId, items.length, tab, loadPage]);

    // Close the 3-dot menu when clicking elsewhere, or pressing Escape
    useEffect(() => {
        if (!menuId) return;
        const onPointerDown = (e) => {
            if (!e.target.closest?.("[data-notif-menu]")) setMenuId(null);
        };
        const onKey = (e) => e.key === "Escape" && setMenuId(null);
        document.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [menuId]);

    // Close the payment popup with Escape
    useEffect(() => {
        if (!payment) return;
        const onKey = (e) => e.key === "Escape" && setPayment(null);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [payment]);

    const saveArchived = (set) => {
        try {
            localStorage.setItem(archiveKey(userId), JSON.stringify([...set]));
        } catch { }
    };

    const openItem = async (item) => {
        if (!item.read_at) {
            const now = new Date().toISOString();
            setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read_at: now } : i)));
            await supabase.from("notifications").update({ read_at: now }).eq("id", item.id);
            notifyChanged();
        }

        // "Payment needed for your merch drop" shows the payment instructions popup
        if (isPaymentNotif(item)) {
            setPayment({
                ...parsePayment(item),
                title: productTitles[item.id] || null,
                approved: isApprovedStatus(productStatuses[item.id]),
            });
            return;
        }

        // "Your listing was approved / under review / removed ..." opens that product's page
        const productId = productIds[item.id];
        const isMyListingNotif = !isAdminNotif(item) && /listing/i.test(item.title || "");
        if (isMyListingNotif && productId) {
            router.push(`/products/${productId}`);
        } else if (item.link?.startsWith("/")) {
            router.push(item.link);
        }
    };

    // Mark one notification as read or unread
    const setRead = async (item, read) => {
        const when = read ? new Date().toISOString() : null;
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read_at: when } : i)));
        const { error } = await supabase.from("notifications").update({ read_at: when }).eq("id", item.id);
        if (error) {
            setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read_at: item.read_at } : i)));
            toast.error("Couldn't update that notification.");
        }
        notifyChanged();
    };

    // Archive hides it from All / Unread / Admin. Find it again in the Archived tab.
    const toggleArchive = async (item) => {
        const wasArchived = archived.has(item.id);
        const next = new Set(archived);
        if (wasArchived) next.delete(item.id);
        else next.add(item.id);
        setArchived(next);
        saveArchived(next);
        toast.success(wasArchived ? "Moved back to your notifications." : "Notification archived.");
        // archiving also marks it read so the red badge stops counting it
        if (!wasArchived && !item.read_at) await setRead(item, true);
    };

    const deleteItem = async (item) => {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        const { data, error } = await supabase
            .from("notifications")
            .delete()
            .eq("id", item.id)
            .eq("user_id", userId)
            .select("id");
        if (error || !data || data.length === 0) {
            console.error("[NotificationsPage] delete failed:", error || "no rows deleted (check the delete policy)");
            setItems((prev) => [...prev, item].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
            toast.error("Couldn't delete that notification.");
            return;
        }
        offsetRef.current = Math.max(0, offsetRef.current - 1);
        if (archived.has(item.id)) {
            const next = new Set(archived);
            next.delete(item.id);
            setArchived(next);
            saveArchived(next);
        }
        toast.success("Notification deleted.");
        notifyChanged();
    };

    const markAllRead = async () => {
        const now = new Date().toISOString();
        const ids = pool.filter((i) => !i.read_at).map((i) => i.id);
        if (ids.length === 0) return;
        setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, read_at: now } : i)));
        const { error } = await supabase.from("notifications").update({ read_at: now }).in("id", ids);
        if (error) toast.error("Couldn't mark all as read.");
        notifyChanged();
    };

    const toggleEmail = async () => {
        const next = !emailOn;
        setEmailOn(next);
        const { error } = await supabase
            .from("notification_prefs")
            .upsert(
                { user_id: userId, email_enabled: next, updated_at: new Date().toISOString() },
                { onConflict: "user_id" }
            );
        if (error) {
            setEmailOn(!next);
            toast.error("Couldn't save your email preference.");
        }
    };

    // ---- what to show ----
    const activeItems = items.filter((i) => !archived.has(i.id));
    const adminItems = isAdmin ? activeItems.filter(isAdminNotif) : [];
    const personalItems = activeItems.filter((i) => !isAdminNotif(i));
    const archivedItems = items.filter((i) => archived.has(i.id) && (!isAdminNotif(i) || isAdmin));
    const adminUnread = adminItems.filter((i) => !i.read_at).length;
    const adminPending = adminItems.filter((i) => !adminStates[i.id]?.resolved).length;
    const isAdminTab = tab === "admin";
    const isArchivedTab = tab === "archived";
    const pool = isAdminTab ? adminItems : isArchivedTab ? archivedItems : personalItems;
    const visible = tab === "unread" ? pool.filter((i) => !i.read_at) : pool;
    const fresh = visible.filter((i) => !i.read_at);
    const earlier = visible.filter((i) => i.read_at);
    const hasUnread = !isArchivedTab && pool.some((i) => !i.read_at);

    const tabs = [
        ["all", "All"],
        ["unread", "Unread"],
        ...(adminItems.length > 0 ? [["admin", "Admin"]] : []),
        ...(archivedItems.length > 0 ? [["archived", "Archived"]] : []),
    ];
    // If the current tab disappears (e.g. everything in it was archived), go back to All
    useEffect(() => {
        if (!tabs.some(([k]) => k === tab)) setTab("all");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, adminItems.length, archivedItems.length]);

    const menuRowCls =
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-left hover:bg-muted transition-colors cursor-pointer";

    const renderRow = (item) => {
        // Admin notifications get a color, icon and label based on what they are
        const kind = isAdminNotif(item) ? ADMIN_KINDS[adminKind(item)] : null;
        const state = kind ? adminStates[item.id] : null;
        const resolved = !!state?.resolved;
        const bad = resolved && /rejected|removed/i.test(state.label);
        const isArchived = archived.has(item.id);

        let FallbackIcon = kind ? kind.Icon : pickIcon(item.title);
        let iconBox = kind ? kind.iconBox : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
        if (resolved) {
            FallbackIcon = bad ? kind.Icon : CheckCircle2;
            iconBox = bad
                ? "bg-rose-500/15 text-rose-500 dark:text-rose-400"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
        }
        const accent = kind ? kind.text : "text-emerald-600 dark:text-emerald-400";
        const dot = kind ? kind.dot : "bg-emerald-600";
        const title = resolved ? resolvedTitle(item, state) : item.title;
        const statusChip = !kind
            ? null
            : resolved
                ? bad
                    ? "bg-rose-500/15 text-rose-500 dark:text-rose-400"
                    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/15 text-amber-500 dark:text-amber-400";

        const cardCls = item.read_at
            ? "border-border bg-card/40 hover:bg-muted/60"
            : kind
                ? "border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10"
                : "border-emerald-600/40 bg-emerald-500/5 hover:bg-emerald-500/10";

        return (
            <li key={item.id} className="relative">
                <div className={`flex items-center gap-1 pr-1 rounded-2xl border transition-colors ${cardCls}`}>
                    <button
                        type="button"
                        onClick={() => openItem(item)}
                        className="flex-1 min-w-0 flex items-center gap-3 pl-4 pr-2 py-3.5 text-left cursor-pointer"
                    >
                        {images[item.id] ? (
                            <img
                                src={images[item.id]}
                                alt=""
                                className="w-16 h-16 rounded-xl object-cover shrink-0 bg-muted"
                            />
                        ) : (
                            <div className={`w-16 h-16 rounded-xl flex items-center justify-center shrink-0 ${iconBox}`}>
                                <FallbackIcon size={26} />
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold line-clamp-2">{title}</p>
                            {item.body && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.body}</p>
                            )}
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                {kind && (
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${kind.chip}`}>
                                        {kind.label}
                                    </span>
                                )}
                                {kind && (
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${statusChip}`}>
                                        {resolved ? state.label : "Pending"}
                                    </span>
                                )}
                                <span className={`text-[11px] font-semibold ${item.read_at ? "text-muted-foreground" : accent}`}>
                                    {timeAgo(item.created_at)}
                                </span>
                            </div>
                        </div>
                        {!item.read_at && <span className={`w-3 h-3 rounded-full shrink-0 ${dot}`} />}
                    </button>

                    <button
                        type="button"
                        data-notif-menu
                        aria-label="More options"
                        aria-haspopup="menu"
                        aria-expanded={menuId === item.id}
                        onClick={() => setMenuId((cur) => (cur === item.id ? null : item.id))}
                        className="shrink-0 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-background/70 transition-colors cursor-pointer"
                    >
                        <MoreHorizontal size={20} />
                    </button>
                </div>

                {menuId === item.id && (
                    <div
                        data-notif-menu
                        role="menu"
                        className="absolute right-3 top-full -mt-1 z-20 w-52 rounded-xl border border-border bg-background p-1 shadow-2xl"
                    >
                        <button
                            type="button"
                            role="menuitem"
                            className={`${menuRowCls} text-foreground`}
                            onClick={() => {
                                setMenuId(null);
                                setRead(item, !item.read_at);
                            }}
                        >
                            {item.read_at ? <Mail size={16} /> : <MailOpen size={16} />}
                            {item.read_at ? "Mark as unread" : "Mark as read"}
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className={`${menuRowCls} text-foreground`}
                            onClick={() => {
                                setMenuId(null);
                                toggleArchive(item);
                            }}
                        >
                            {isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                            {isArchived ? "Unarchive" : "Archive"}
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className={`${menuRowCls} text-rose-500`}
                            onClick={() => {
                                setMenuId(null);
                                deleteItem(item);
                            }}
                        >
                            <Trash2 size={16} />
                            Delete notification
                        </button>
                    </div>
                )}
            </li>
        );
    };

    return (
        <div className="max-w-2xl w-full mx-auto px-4 py-6 text-foreground">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-black flex items-center gap-2">
                    <Bell size={22} /> Notifications
                </h1>
                {hasUnread && (
                    <button
                        onClick={markAllRead}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-border hover:bg-muted transition-colors cursor-pointer"
                    >
                        <CheckCheck size={14} /> Mark all as read
                    </button>
                )}
            </div>

            <label className="flex items-center gap-2 mb-4 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={emailOn}
                    onChange={toggleEmail}
                    className="accent-emerald-700"
                />
                Email me about important updates (suspensions, approvals, removed listings)
            </label>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
                {tabs.map(([key, label]) => {
                    const adminTab = key === "admin";
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${tab === key
                                    ? adminTab
                                        ? "bg-purple-500/15 text-purple-500 dark:text-purple-400"
                                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    : "text-muted-foreground hover:bg-muted"
                                }`}
                        >
                            {label}
                            {adminTab && adminUnread > 0 && (
                                <span className="bg-purple-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                                    {adminUnread > 99 ? "99+" : adminUnread}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="animate-spin text-muted-foreground" size={28} />
                </div>
            ) : visible.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-16">
                    {isArchivedTab
                        ? "No archived notifications."
                        : tab === "unread" || isAdminTab
                            ? "You're all caught up."
                            : "You're all caught up. Nothing here yet."}
                </p>
            ) : isArchivedTab ? (
                <ul className="space-y-2">{visible.map(renderRow)}</ul>
            ) : isAdminTab ? (
                <div>
                    <p className="pb-1 text-xs text-muted-foreground">
                        {adminPending === 0
                            ? "Nothing is waiting for you."
                            : `${adminPending} ${adminPending === 1 ? "item needs" : "items need"} your attention`}
                    </p>
                    {ADMIN_KIND_ORDER.map((k) => {
                        const group = adminItems
                            .filter((i) => adminKind(i) === k)
                            .sort((a, b) => (adminStates[a.id]?.resolved ? 1 : 0) - (adminStates[b.id]?.resolved ? 1 : 0)); // pending first
                        if (group.length === 0) return null;
                        const unread = group.filter((i) => !i.read_at).length;
                        const pending = group.filter((i) => !adminStates[i.id]?.resolved).length;
                        const kind = ADMIN_KINDS[k];
                        return (
                            <section key={k} className="mt-4">
                                <div className="flex items-center justify-between pb-2">
                                    <h2 className="text-sm font-bold">
                                        {kind.group}{" "}
                                        <span className="font-semibold text-muted-foreground">
                                            ({pending} pending / {group.length})
                                        </span>
                                    </h2>
                                    {unread > 0 && (
                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${kind.chip}`}>
                                            {unread} new
                                        </span>
                                    )}
                                </div>
                                <ul className="space-y-2">{group.map(renderRow)}</ul>
                            </section>
                        );
                    })}
                </div>
            ) : (
                <div className="space-y-5">
                    {fresh.length > 0 && (
                        <section>
                            <h2 className="pb-2 text-sm font-bold">New</h2>
                            <ul className="space-y-2">{fresh.map(renderRow)}</ul>
                        </section>
                    )}
                    {earlier.length > 0 && (
                        <section>
                            <h2 className="pb-2 text-sm font-bold">Earlier</h2>
                            <ul className="space-y-2">{earlier.map(renderRow)}</ul>
                        </section>
                    )}
                </div>
            )}

            {/* More notifications load automatically when this comes into view */}
            {!loading && hasMore && (
                <div ref={sentinelRef} className="flex justify-center pt-5">
                    <button
                        type="button"
                        onClick={() => loadPage(userId, true)}
                        disabled={loadingMore}
                        className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl border border-border hover:bg-muted disabled:opacity-60 transition-colors cursor-pointer"
                    >
                        {loadingMore && <Loader2 className="animate-spin" size={14} />}
                        {loadingMore ? "Loading..." : "Load older notifications"}
                    </button>
                </div>
            )}
            {!loading && !hasMore && items.length >= PAGE_SIZE && (
                <p className="text-center text-xs text-muted-foreground pt-5">You&apos;ve reached the end.</p>
            )}

            {/* PAYMENT REQUIRED POPUP (merch drop notifications) */}
            {payment &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                        onClick={() => setPayment(null)}
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="payment-required-title"
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-border bg-background text-foreground shadow-2xl p-6 sm:p-7"
                        >
                            {/* Header */}
                            <div className="flex items-center gap-4 pb-5 border-b border-border">
                                <div
                                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${payment.approved ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"
                                        }`}
                                >
                                    {payment.approved ? <CheckCircle2 size={24} /> : <CreditCard size={24} />}
                                </div>
                                <div className="min-w-0">
                                    <h2 id="payment-required-title" className="text-lg font-black uppercase tracking-wide">
                                        {payment.approved ? "Payment Received" : "Payment Required"}
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        {payment.approved ? "Merchandise Drop Approved" : "Merchandise Drop Verification"}
                                    </p>
                                </div>
                            </div>

                            {payment.approved ? (
                                <div className="mt-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                                        Payment received. Listing approved.
                                    </p>
                                    <p className="mt-2 text-sm text-foreground/90">
                                        {payment.title ? (
                                            <>
                                                Your merch drop &quot;<span className="italic">{payment.title}</span>&quot; is now live on the
                                                marketplace.
                                            </>
                                        ) : (
                                            "Your merch drop is now live on the marketplace."
                                        )}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Fee */}
                                    {payment.amount && (
                                        <div className="mt-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
                                            <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                                Total Listing Fee to Settle:
                                            </p>
                                            <p className="mt-1 text-3xl font-black text-amber-600 dark:text-amber-400">
                                                {payment.amount}
                                            </p>
                                        </div>
                                    )}

                                    {/* Instructions */}
                                    <p className="mt-5 mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                        Payment Instructions:
                                    </p>
                                    <div className="rounded-xl border border-border bg-muted/50 p-4">
                                        <p className="text-sm font-bold">GCash Account:</p>
                                        <p className="mt-1 text-lg font-black tracking-wide text-emerald-600 dark:text-emerald-400 select-all">
                                            {payment.number || "Check your notification for the number"}
                                        </p>
                                        <p className="mt-1 text-xs text-muted-foreground">{GCASH_ACCOUNT_NAME}</p>
                                    </div>

                                    <p className="mt-5 text-sm font-bold">Steps after paying:</p>
                                    <ol className="mt-2 list-decimal pl-5 space-y-1 text-xs text-foreground/90">
                                        <li>Take a screenshot of your GCash payment receipt.</li>
                                        <li>
                                            Send an email to <span className="font-bold">{PAYMENT_EMAIL}</span>.
                                        </li>
                                        <li>
                                            Include your item title
                                            {payment.title && (
                                                <>
                                                    {" "}
                                                    (&quot;<span className="italic">{payment.title}</span>&quot;)
                                                </>
                                            )}{" "}
                                            and attach the receipt screenshot.
                                        </li>
                                    </ol>
                                </>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    setPayment(null);
                                    router.push("/mylistings");
                                }}
                                className="mt-6 w-full py-4 rounded-2xl bg-foreground text-background text-sm font-black uppercase tracking-wide hover:opacity-90 transition-opacity cursor-pointer"
                            >
                                {payment.approved ? "Go to my listings" : "I understand, go to my listings"}
                            </button>
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
}