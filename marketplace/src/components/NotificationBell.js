"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
    Bell, Flag, ShoppingBag, Tag, Loader2, CreditCard, CheckCircle2, AlertTriangle, ShieldCheck,
    MoreHorizontal, Archive, ArchiveRestore, Trash2, Mail, MailOpen, MessageSquare, ChevronDown, Clock, XCircle, ShieldOff
} from "lucide-react";

// How many notifications load at a time. More load automatically as you scroll down.
const PAGE_SIZE = 20;

const archiveKey = (uid) => `notifications:archived:${uid}`;

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Shown in the payment popup. Change these if the admin account changes.
const GCASH_ACCOUNT_NAME = "OLFU Marketplace Admin";
const PAYMENT_EMAIL = "olfumarketplace@gmail.com";

// Route of the admin reports page (the one with the Moderation Queue). Change if yours differs.
const ADMIN_REPORTS_PATH = "/admin/reports";
// Route of the admin flagged-content page. Change if yours differs.
const ADMIN_FLAGGED_PATH = "/admin/flagged";

// How close (in time) a payment notification and a product must be to be matched
const PAYMENT_MATCH_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours

// How close (in time) a report notification and its report row must be to be matched
const REPORT_MATCH_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

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
// (If you add a `type` or `audience` column with the value "admin", that works too.)
const ADMIN_PATTERNS = /needs review|report to review|awaiting approval|org application|new application|flagged/i;
const isAdminNotif = (n) =>
    n.type === "admin" || n.audience === "admin" || ADMIN_PATTERNS.test(n.title || "");

// Each kind of admin notification gets its own icon, color and group heading.
// (Full class names are written out so Tailwind keeps them.)
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
    itemReport: {
        label: "Item report",
        group: "Item reports",
        Icon: Flag,
        iconBox: "bg-rose-500/15 text-rose-500 dark:text-rose-400",
        text: "text-rose-500 dark:text-rose-400",
        dot: "bg-rose-500",
        chip: "bg-rose-500/15 text-rose-500 dark:text-rose-400",
    },
    chatReport: {
        label: "Chat report",
        group: "Chat reports",
        Icon: MessageSquare,
        iconBox: "bg-orange-500/15 text-orange-500 dark:text-orange-400",
        text: "text-orange-500 dark:text-orange-400",
        dot: "bg-orange-500",
        chip: "bg-orange-500/15 text-orange-500 dark:text-orange-400",
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
const ADMIN_KIND_ORDER = ["itemReport", "chatReport", "report", "flagged", "merch", "other"];
const adminKind = (n) => {
    const t = n.title || "";
    if (/report to review/i.test(t)) return "report";
    if (/needs review|flagged/i.test(t)) return "flagged";
    if (/awaiting approval/i.test(t)) return "merch";
    return "other";
};

// ---- Organization requests (user side): under review / approved / rejected / revoked ----
// The status is read from the notification text, so it works with whatever wording your
// notification code writes. Order matters: "revoked" and "not approved" are checked before "approved".
const ORG_STATUS = {
    review: {
        label: "Under review",
        title: "Your organization request is under review",
        Icon: Clock,
        iconBox: "bg-amber-500/15 text-amber-500 dark:text-amber-400",
        text: "text-amber-500 dark:text-amber-400",
        dot: "bg-amber-500",
        chip: "bg-amber-500/15 text-amber-500 dark:text-amber-400",
    },
    approved: {
        label: "Approved",
        title: "Your organization was approved",
        Icon: CheckCircle2,
        iconBox: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        text: "text-emerald-600 dark:text-emerald-400",
        dot: "bg-emerald-600",
        chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    rejected: {
        label: "Rejected",
        title: "Your organization request was rejected",
        Icon: XCircle,
        iconBox: "bg-rose-500/15 text-rose-500 dark:text-rose-400",
        text: "text-rose-500 dark:text-rose-400",
        dot: "bg-rose-500",
        chip: "bg-rose-500/15 text-rose-500 dark:text-rose-400",
    },
    revoked: {
        label: "Revoked",
        title: "Your organization approval was revoked",
        Icon: ShieldOff,
        iconBox: "bg-orange-500/15 text-orange-500 dark:text-orange-400",
        text: "text-orange-500 dark:text-orange-400",
        dot: "bg-orange-500",
        chip: "bg-orange-500/15 text-orange-500 dark:text-orange-400",
    },
};
const isOrgNotif = (n) => {
    if (isAdminNotif(n)) return false;
    const t = n.title || "";
    // Only notifications addressed to the applicant ("Your organization ..."). Admin-side ones
    // such as "New organization application" must not be rewritten into "under review".
    if (!/^\s*your\b/i.test(t)) return false;
    return /organi[sz]ation|\borg\b/i.test(t) && /application|request|approv|reject|revok|review|declin|denied/i.test(t);
};
const orgStatusOf = (n) => {
    const t = n.title || "";
    if (/revok|suspend|deactivat|removed/i.test(t)) return "revoked";
    if (/not approved|reject|declin|denied/i.test(t)) return "rejected";
    if (/approved|accepted/i.test(t)) return "approved";
    return "review";
};

// ---- Reports: item reports vs chat reports ----
// Works out what a row of your `reports` table is about. It checks a type-like column first,
// then falls back to which id column is filled in. If your column names differ, add them here.
const PRODUCT_TAG_RE = /\[Product Report:\s*"([^"]+)"\]\s*/i;
const reportTitleFromReason = (r) => String(r.reason || "").match(PRODUCT_TAG_RE)?.[1] ?? null;
// Same rule as the admin reports page: a product_id (or the "[Product Report: ...]" tag in the
// reason) means an item report; everything else is a user / chat report.
const reportTypeOf = (r) => (r.product_id || reportTitleFromReason(r) ? "item" : "chat");
const reportProductId = (r) => r.product_id || null;
const isPendingReport = (r) => !r.status || String(r.status).toLowerCase() === "pending";
const reportOutcome = (r) => {
    const st = String(r.status || "").trim();
    return st ? st[0].toUpperCase() + st.slice(1).toLowerCase() : "Resolved";
};

// The kind of an admin notification, splitting reports into item / chat reports
// once we know which one each is (info comes from the matched report row).
const kindKeyOf = (n, reportInfo) => {
    const k = adminKind(n);
    if (k !== "report") return k;
    const type = reportInfo?.[n.id]?.type;
    return type === "chat" ? "chatReport" : type === "item" ? "itemReport" : "report";
};

// What happened to a listing once it left "pending"/"flagged": "Approved", "Rejected" or "Removed".
const outcomeOf = (status) => {
    const st = String(status || "").toLowerCase();
    if (st === "rejected") return "Rejected";
    if (st === "removed" || st === "deleted") return "Removed";
    return isApprovedStatus(st) ? "Approved" : "Resolved";
};

// Title shown on an admin notification once it has been handled
const resolvedTitle = (n, state, kindKey) => {
    const word = (state?.label || "Resolved").toLowerCase();
    if (kindKey === "itemReport") return `Item report ${word}`;
    if (kindKey === "chatReport") return `Chat report ${word}`;
    if (kindKey === "report") return `Report ${word}`;
    if (kindKey === "flagged") return `Flagged listing ${word}`;
    if (kindKey === "merch") return `Merch listing ${word}`;
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

// Same staff roles your admin code uses (profiles.role): moderator, admin, super_admin / superadmin.
// Comparison ignores case, spaces, dashes and underscores.
const norm = (v) => String(v ?? "").toLowerCase().replace(/[^a-z]/g, "");
const STAFF_ROLES = ["moderator", "admin", "superadmin"];
const hasAdminAccess = (profile) => !!profile && STAFF_ROLES.includes(norm(profile.role));

const notifyChanged = () => window.dispatchEvent(new Event("notifications:changed"));

const timeAgo = (iso) => {
    const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return "now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d`;
    return `${Math.floor(d / 7)}w`;
};

export default function NotificationBell({ count = 0, userId }) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState("all");
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uid, setUid] = useState(userId ?? null);
    const [loadError, setLoadError] = useState(false);
    const [images, setImages] = useState({}); // notification id -> photo url
    const [productIds, setProductIds] = useState({}); // notification id -> product id
    const [productTitles, setProductTitles] = useState({}); // notification id -> product title
    const [productStatuses, setProductStatuses] = useState({}); // notification id -> product status
    const [adminStates, setAdminStates] = useState({}); // admin notification id -> { resolved, label }
    const [reportInfo, setReportInfo] = useState({}); // report notification id -> { type, summary }
    const [reportIds, setReportIds] = useState({}); // report notification id -> reports.id (for deep-linking)
    const [batchOf, setBatchOf] = useState({}); // notification id -> 0 for the first load, 1+ for older pages
    const [isAdmin, setIsAdmin] = useState(false); // fails closed: false until verified
    const [payment, setPayment] = useState(null); // { amount, number, title, approved } while the payment popup is open
    const [hasMore, setHasMore] = useState(false); // are there older notifications still to load?
    const [loadingMore, setLoadingMore] = useState(false);
    const [archived, setArchived] = useState(() => new Set()); // archived notification ids (saved in this browser)
    const [menu, setMenu] = useState(null); // { id, top, left } while a row's 3-dot menu is open
    const [notice, setNotice] = useState(null); // small error message under the tabs
    const [adminFilter, setAdminFilter] = useState("all"); // Admin tab: "all" or one admin kind key
    const [handledOpen, setHandledOpen] = useState(() => new Set()); // admin kinds whose "Handled" list is expanded
    const offsetRef = useRef(0); // how many rows were fetched so far
    const reportSeenRef = useRef(0); // report notifications seen on earlier pages
    const batchRef = useRef(0); // number of older pages loaded so far
    const loadingRef = useRef(false);
    const router = useRouter();
    const pathname = usePathname();
    const wrapRef = useRef(null);

    // Use the userId prop if the Navbar passes it, otherwise look it up ourselves
    useEffect(() => {
        if (userId) {
            setUid(userId);
            return;
        }
        supabase.auth.getUser().then(({ data }) => setUid(data?.user?.id ?? null));
    }, [userId]);

    // Archived ids are remembered in this browser, per account
    useEffect(() => {
        if (!uid) {
            setArchived(new Set());
            return;
        }
        try {
            const raw = localStorage.getItem(archiveKey(uid));
            setArchived(new Set(raw ? JSON.parse(raw) : []));
        } catch {
            setArchived(new Set());
        }
    }, [uid]);

    const saveArchived = (set) => {
        try {
            localStorage.setItem(archiveKey(uid), JSON.stringify([...set]));
        } catch { }
    };

    const flash = (msg) => {
        setNotice(msg);
        setTimeout(() => setNotice(null), 5000);
    };

    // Admin notifications are only shown to staff (profiles.role)
    useEffect(() => {
        if (!uid) {
            setIsAdmin(false);
            return;
        }
        let cancelled = false;
        supabase
            .from("profiles")
            .select("role")
            .eq("id", uid)
            .maybeSingle()
            .then(({ data, error }) => {
                if (error) console.error("[NotificationBell] role lookup failed:", error);
                if (!cancelled) setIsAdmin(!error && hasAdminAccess(data));
            });
        return () => {
            cancelled = true;
        };
    }, [uid]);

    // load(false) loads the newest page and resets the list, load(true) loads the next older page
    const load = useCallback(async (append = false) => {
        if (!uid || loadingRef.current) return;
        loadingRef.current = true;
        if (append) {
            setLoadingMore(true);
        } else {
            setLoading(true);
            setLoadError(false);
            offsetRef.current = 0;
            reportSeenRef.current = 0;
            batchRef.current = 0;
        }
        const from = offsetRef.current;
        const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", uid)
            .order("created_at", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);
        if (error) {
            console.error("Notification popup load error:", error);
            if (!append) setLoadError(true);
        } else if (data) {
            offsetRef.current = from + data.length;
            setHasMore(data.length === PAGE_SIZE);
            const titleOf = (n) => (n.body || "").split(" - Reason:")[0].trim();

            // Find the product each notification is about: product id in the link, else the title in the body
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

            // Report notifications only say "New report to review", so match each one to its row in
            // `reports` (by id in the link, else the report created closest in time). That tells us
            // whether it is about an item or a chat, and gives us the item's photo.
            const reportNotifsAll = data.filter((n) => isAdminNotif(n) && adminKind(n) === "report");
            const reportMatch = {}; // notification id -> report row
            const byReport = {}; // notification id -> product (item reports)
            const reportInfoMap = {}; // notification id -> { type, summary }
            if (reportNotifsAll.length > 0) {
                const { data: reps, error: repErr } = await supabase
                    .from("reports")
                    .select("*")
                    .order("created_at", { ascending: false })
                    .limit(200);
                if (repErr) {
                    console.error("[NotificationBell] could not load reports:", repErr);
                } else {
                    const used = new Set();
                    reportNotifsAll.forEach((n) => {
                        // report id in the link: "?report=123" (numeric ids) or a UUID
                        const linkId = n.link?.match(/[?&]report=([^&#]+)/)?.[1] ?? n.link?.match(UUID_RE)?.[0];
                        let r = linkId ? (reps || []).find((x) => String(x.id) === String(linkId) && !used.has(x.id)) : null;
                        if (!r) {
                            const t = new Date(n.created_at).getTime();
                            let bestDiff = Infinity;
                            (reps || []).forEach((x) => {
                                if (used.has(x.id) || !x.created_at) return;
                                const diff = Math.abs(new Date(x.created_at).getTime() - t);
                                if (diff < bestDiff && diff < REPORT_MATCH_WINDOW_MS) {
                                    r = x;
                                    bestDiff = diff;
                                }
                            });
                        }
                        if (r) {
                            used.add(r.id);
                            reportMatch[n.id] = r;
                        }
                    });

                    const reportedIds = [
                        ...new Set(Object.values(reportMatch).map(reportProductId).filter(Boolean)),
                    ];
                    const reportedProducts = {};
                    const reportedByTitle = {};
                    const reasonTitles = [
                        ...new Set(
                            Object.values(reportMatch)
                                .filter((r) => !r.product_id)
                                .map(reportTitleFromReason)
                                .filter(Boolean)
                        ),
                    ];
                    if (reasonTitles.length > 0) {
                        const { data: tprods } = await supabase
                            .from("products")
                            .select("id, title, status, image_urls, created_at")
                            .in("title", reasonTitles)
                            .order("created_at", { ascending: false });
                        (tprods || []).forEach((pr) => {
                            if (!reportedByTitle[pr.title]) reportedByTitle[pr.title] = pr;
                        });
                    }
                    if (reportedIds.length > 0) {
                        const { data: prods } = await supabase
                            .from("products")
                            .select("id, title, status, image_urls")
                            .in("id", reportedIds);
                        (prods || []).forEach((pr) => (reportedProducts[pr.id] = pr));
                    }

                    Object.entries(reportMatch).forEach(([nid, r]) => {
                        const type = reportTypeOf(r);
                        if (!type) {
                            console.warn(
                                "[NotificationBell] couldn't tell if this report is about an item or a chat. Its columns:",
                                Object.keys(r)
                            );
                        }
                        const pr = reportedProducts[reportProductId(r)] || reportedByTitle[reportTitleFromReason(r)];
                        if (pr) byReport[nid] = pr;
                        const reason = String(r.reason ?? "").replace(PRODUCT_TAG_RE, "").trim();
                        const subject = type === "item" ? pr?.title || reportTitleFromReason(r) : "User / chat report";
                        reportInfoMap[nid] = {
                            type,
                            summary: [subject, reason].filter(Boolean).join(" - "),
                        };
                    });
                }
            }

            // Remember which reports.id each report notification matched, so clicking it can open that exact report
            const reportIdMap = {};
            Object.entries(reportMatch).forEach(([nid, r]) => (reportIdMap[nid] = r.id));

            const productOf = (n) =>
                byId[idByNotif[n.id]] || byTitle[titleOf(n)] || byTime[n.id] || byReport[n.id] || null;

            // Work out whether each admin notification is still waiting or already handled.
            // Handled ones stay in the list with their outcome instead of disappearing.
            const done = new Set(); // handled ones (also marked as read below)
            const adminState = {}; // notification id -> { resolved, label }
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

            // Reports: a matched report is pending until its own status changes. Notifications that
            // couldn't be matched fall back to the pending-report count (the newest ones stay pending).
            const reportNotifs = reportNotifsAll;
            reportNotifs.forEach((n) => {
                const r = reportMatch[n.id];
                if (r && !isPendingReport(r)) {
                    adminState[n.id] = { resolved: true, label: reportOutcome(r) };
                    done.add(n.id);
                }
            });
            if (reportNotifs.some((n) => !reportMatch[n.id])) {
                const { count: pendingCount, error: countError } = await supabase
                    .from("reports")
                    .select("id", { count: "exact", head: true })
                    .or("status.eq.pending,status.is.null");
                if (!countError && pendingCount !== null) {
                    const seen = reportSeenRef.current; // report notifications on earlier pages
                    reportNotifs.forEach((n, idx) => {
                        if (reportMatch[n.id]) return;
                        if (seen + idx < pendingCount) return; // list is newest first
                        adminState[n.id] = { resolved: true, label: "Resolved" };
                        done.add(n.id);
                    });
                }
            }

            reportSeenRef.current += reportNotifs.length;
            const live = data;
            setItems((prev) => {
                if (!append) return live;
                const seenIds = new Set(prev.map((i) => i.id));
                return [...prev, ...live.filter((i) => !seenIds.has(i.id))];
            });
            setAdminStates((prev) => (append ? { ...prev, ...adminState } : adminState));
            setReportInfo((prev) => (append ? { ...prev, ...reportInfoMap } : reportInfoMap));
            setReportIds((prev) => (append ? { ...prev, ...reportIdMap } : reportIdMap));
            if (append) batchRef.current += 1;
            const batchMap = {};
            data.forEach((n) => (batchMap[n.id] = batchRef.current));
            setBatchOf((prev) => (append ? { ...prev, ...batchMap } : batchMap));

            // Mark handled ones as read, so the red badge stops counting them
            const staleUnread = data.filter((n) => done.has(n.id) && !n.read_at).map((n) => n.id);
            if (staleUnread.length > 0) {
                await supabase
                    .from("notifications")
                    .update({ read_at: new Date().toISOString() })
                    .in("id", staleUnread);
                notifyChanged();
            }

            // Photos: image_url if the row has one, otherwise the product's first photo
            const map = {};
            live.forEach((n) => {
                const url = n.image_url || productOf(n)?.image_urls?.[0];
                if (url) map[n.id] = url;
            });
            setImages((prev) => (append ? { ...prev, ...map } : map));

            const pids = {};
            const ptitles = {};
            const pstatuses = {};
            live.forEach((n) => {
                const pr = productOf(n);
                if (pr?.id) pids[n.id] = pr.id;
                if (pr?.title) ptitles[n.id] = pr.title;
                if (pr?.status) pstatuses[n.id] = pr.status;
            });
            setProductIds((prev) => (append ? { ...prev, ...pids } : pids));
            setProductTitles((prev) => (append ? { ...prev, ...ptitles } : ptitles));
            setProductStatuses((prev) => (append ? { ...prev, ...pstatuses } : pstatuses));
        }
        loadingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
    }, [uid]);

    // Fetch fresh notifications every time the popup opens
    useEffect(() => {
        if (open) load(false);
    }, [open, load]);

    // Close when clicking anywhere outside the bell/popup, or pressing Escape
    useEffect(() => {
        if (!open) return;
        const onPointerDown = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
            if (!e.target.closest?.("[data-notif-menu]")) setMenu(null);
        };
        const onKey = (e) => e.key === "Escape" && setOpen(false);
        document.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    // Close the payment popup with Escape
    useEffect(() => {
        if (!payment) return;
        const onKey = (e) => e.key === "Escape" && setPayment(null);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [payment]);

    // Forget any open 3-dot menu when the popup closes
    useEffect(() => {
        if (!open) setMenu(null);
    }, [open]);

    // Close when the page changes (sidebar links, etc.)
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    const openItem = async (item) => {
        setOpen(false);
        if (!item.read_at) {
            const now = new Date().toISOString();
            setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read_at: now } : i)));
            await supabase.from("notifications").update({ read_at: now }).eq("id", item.id);
            notifyChanged();
        }

        // Report notifications (item or chat) open that exact report on the reports page
        if (isAdminNotif(item) && adminKind(item) === "report") {
            const rid = reportIds[item.id];
            console.log("[NotificationBell] report click", { notification: item.id, reportId: rid, link: item.link });
            router.push(
                rid
                    ? `${ADMIN_REPORTS_PATH}?report=${rid}`
                    : item.link?.startsWith("/")
                        ? item.link
                        : ADMIN_REPORTS_PATH
            );
            return;
        }

        // Flagged listing notifications open that exact listing on the flagged page
        if (isAdminNotif(item) && adminKind(item) === "flagged") {
            const pid = productIds[item.id];
            router.push(
                pid
                    ? `${ADMIN_FLAGGED_PATH}?product=${pid}`
                    : item.link?.startsWith("/")
                        ? item.link
                        : ADMIN_FLAGGED_PATH
            );
            return;
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

    const markAllRead = async () => {
        const now = new Date().toISOString();
        const ids = pool.filter((i) => !i.read_at).map((i) => i.id);
        if (ids.length === 0) return;
        setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, read_at: now } : i)));
        await supabase.from("notifications").update({ read_at: now }).in("id", ids);
        notifyChanged();
    };

    // Mark one notification as read or unread
    const setRead = async (item, read) => {
        const when = read ? new Date().toISOString() : null;
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read_at: when } : i)));
        const { error } = await supabase.from("notifications").update({ read_at: when }).eq("id", item.id);
        if (error) {
            console.error("[NotificationBell] could not update read state:", error);
            setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read_at: item.read_at } : i)));
            flash("Couldn't update that notification. Try again.");
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
        // archiving also marks it read so the red badge stops counting it
        if (!wasArchived && !item.read_at) await setRead(item, true);
    };

    const deleteItem = async (item) => {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        const { data, error } = await supabase
            .from("notifications")
            .delete()
            .eq("id", item.id)
            .eq("user_id", uid)
            .select("id");
        if (error || !data || data.length === 0) {
            console.error("[NotificationBell] delete failed:", error || "no rows deleted (check the delete policy)");
            setItems((prev) =>
                [...prev, item].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            );
            flash("Couldn't delete that notification.");
            return;
        }
        offsetRef.current = Math.max(0, offsetRef.current - 1);
        if (archived.has(item.id)) {
            const next = new Set(archived);
            next.delete(item.id);
            setArchived(next);
            saveArchived(next);
        }
        notifyChanged();
    };

    // Open the 3-dot menu next to a notification
    const openMenu = (e, item) => {
        e.stopPropagation();
        if (menu?.id === item.id) {
            setMenu(null);
            return;
        }
        const r = e.currentTarget.getBoundingClientRect();
        const MENU_H = 150;
        const top = r.bottom + MENU_H > window.innerHeight ? r.top - MENU_H : r.bottom + 4;
        setMenu({ id: item.id, top, left: Math.max(8, r.right - 192) });
    };

    // Load the next page when the list is scrolled near the bottom
    const onListScroll = (e) => {
        if (menu) setMenu(null);
        const el = e.currentTarget;
        if (hasMore && !loadingRef.current && el.scrollTop + el.clientHeight >= el.scrollHeight - 160) {
            load(true);
        }
    };

    const activeItems = items.filter((i) => !archived.has(i.id));
    const adminItems = isAdmin ? activeItems.filter(isAdminNotif) : [];
    const personalItems = activeItems.filter((i) => !isAdminNotif(i));
    const archivedItems = items.filter((i) => archived.has(i.id) && (!isAdminNotif(i) || isAdmin));
    const adminUnread = adminItems.filter((i) => !i.read_at).length;
    const adminPending = adminItems.filter((i) => !adminStates[i.id]?.resolved).length;
    // Admin tab: which kinds exist, and the active filter (falls back to "all" if that kind is gone)
    const kindsPresent = ADMIN_KIND_ORDER.filter((k) => adminItems.some((i) => kindKeyOf(i, reportInfo) === k));
    const activeFilter = kindsPresent.includes(adminFilter) ? adminFilter : "all";
    const isAdminTab = tab === "admin";
    const isArchivedTab = tab === "archived";
    const pool = isAdminTab ? adminItems : isArchivedTab ? archivedItems : personalItems;
    const visible = tab === "unread" ? pool.filter((i) => !i.read_at) : pool;
    // Notifications from "Load older" always render in their own section at the bottom,
    // so they never jump up into New / Earlier or into the groups above.
    const isOlderPage = (i) => (batchOf[i.id] ?? 0) > 0;
    // All / Unread / Archived tabs: just "Today" and "Older"
    const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
    const todayItems = visible.filter((i) => isToday(i.created_at));
    const olderItems = visible.filter((i) => !isToday(i.created_at));

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

    const renderRow = (item) => {
        // Admin notifications get a color, icon and label based on what they are
        const kindKey = isAdminNotif(item) ? kindKeyOf(item, reportInfo) : null;
        const kind = kindKey ? ADMIN_KINDS[kindKey] : null;
        const state = kind ? adminStates[item.id] : null;
        const resolved = !!state?.resolved;
        const bad = resolved && /rejected|removed/i.test(state.label);

        // Organization requests get their own status (under review / approved / rejected / revoked)
        const org = !kind && isOrgNotif(item) ? ORG_STATUS[orgStatusOf(item)] : null;

        let FallbackIcon = kind ? kind.Icon : org ? org.Icon : pickIcon(item.title);
        let iconBox = kind ? kind.iconBox : org ? org.iconBox : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
        if (resolved) {
            FallbackIcon = bad ? kind.Icon : CheckCircle2;
            iconBox = bad
                ? "bg-rose-500/15 text-rose-500 dark:text-rose-400"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
        }
        const accent = kind ? kind.text : org ? org.text : "text-emerald-600 dark:text-emerald-400";
        const dot = kind ? kind.dot : org ? org.dot : "bg-emerald-600";
        // "New report to review" becomes "New item report to review" / "New chat report to review"
        const title = org
            ? org.title
            : resolved
                ? resolvedTitle(item, state, kindKey)
                : kindKey === "itemReport" || kindKey === "chatReport"
                    ? (item.title || "").replace(/\breport\b/i, kindKey === "chatReport" ? "chat report" : "item report")
                    : item.title;
        const body = item.body || reportInfo[item.id]?.summary;
        const statusChip = !kind
            ? null
            : resolved
                ? bad
                    ? "bg-rose-500/15 text-rose-500 dark:text-rose-400"
                    : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/15 text-amber-500 dark:text-amber-400";

        return (
            <div
                key={item.id}
                className="flex items-center gap-1 pr-1 rounded-lg hover:bg-muted transition-colors"
            >
                <button
                    type="button"
                    onClick={() => openItem(item)}
                    className="flex-1 min-w-0 flex items-center gap-3 pl-3 pr-2 py-2.5 text-left cursor-pointer"
                >
                    {images[item.id] ? (
                        <img
                            src={images[item.id]}
                            alt=""
                            className="w-14 h-14 rounded-xl object-cover shrink-0 bg-muted"
                        />
                    ) : (
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${iconBox}`}>
                            <FallbackIcon size={24} />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground line-clamp-2">{title}</p>
                        {body && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{body}</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                            {org && (
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${org.chip}`}>
                                    {org.label}
                                </span>
                            )}
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
                            <span className={`text-xs font-semibold ${item.read_at ? "text-muted-foreground" : accent}`}>
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
                    aria-expanded={menu?.id === item.id}
                    onClick={(e) => openMenu(e, item)}
                    className="shrink-0 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-background/70 transition-colors cursor-pointer"
                >
                    <MoreHorizontal size={18} />
                </button>
            </div>
        );
    };

    // Admin notifications grouped by kind. Each group shows what still needs attention first;
    // handled ones are tucked into a collapsible "Handled" list.
    const renderAdminGroups = (list) =>
        ADMIN_KIND_ORDER.map((k) => {
            if (activeFilter !== "all" && activeFilter !== k) return null;
            const group = list.filter((i) => kindKeyOf(i, reportInfo) === k);
            if (group.length === 0) return null;
            const pendingList = group.filter((i) => !adminStates[i.id]?.resolved);
            const handledList = group.filter((i) => adminStates[i.id]?.resolved);
            const unread = group.filter((i) => !i.read_at).length;
            const kind = ADMIN_KINDS[k];
            const KindIcon = kind.Icon;
            const showHandled = handledOpen.has(k);
            const toggleHandled = () =>
                setHandledOpen((prev) => {
                    const next = new Set(prev);
                    if (next.has(k)) next.delete(k);
                    else next.add(k);
                    return next;
                });
            return (
                <div key={k} className="mt-3 rounded-xl border border-border overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/60">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${kind.iconBox}`}>
                                <KindIcon size={15} />
                            </span>
                            <p className="text-sm font-bold text-foreground truncate">{kind.group}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            {unread > 0 && (
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${kind.chip}`}>
                                    {unread} new
                                </span>
                            )}
                            <span
                                className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${pendingList.length > 0
                                        ? "bg-amber-500/15 text-amber-500 dark:text-amber-400"
                                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                    }`}
                            >
                                {pendingList.length > 0 ? `${pendingList.length} pending` : "All done"}
                            </span>
                        </div>
                    </div>

                    <div className="p-1">
                        {pendingList.length > 0 ? (
                            pendingList.map(renderRow)
                        ) : (
                            <p className="px-3 py-2 text-xs text-muted-foreground">Nothing waiting here.</p>
                        )}

                        {handledList.length > 0 && (
                            <>
                                <button
                                    type="button"
                                    onClick={toggleHandled}
                                    aria-expanded={showHandled}
                                    className="w-full flex items-center justify-between px-3 py-2 mt-1 rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                                >
                                    <span>Handled ({handledList.length})</span>
                                    <ChevronDown size={14} className={`transition-transform ${showHandled ? "rotate-180" : ""}`} />
                                </button>
                                {showHandled && handledList.map(renderRow)}
                            </>
                        )}
                    </div>
                </div>
            );
        });

    return (
        <div ref={wrapRef} className="relative hidden sm:block">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-label={count ? `${count} unread notifications` : "Notifications"}
                aria-haspopup="menu"
                aria-expanded={open}
                title="Notifications"
                className={`relative p-2.5 rounded-full border border-black dark:border-white text-foreground transition-all cursor-pointer ${open
                        ? "bg-emerald-500/15"
                        : "bg-white dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                    }`}
            >
                <Bell size={20} className={open ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"} />
                {count > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                        {count > 9 ? "9+" : count}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <div
                        role="menu"
                        className="absolute right-0 top-full mt-2 w-[460px] max-w-[calc(100vw-1.5rem)] z-20 bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 pt-4 pb-2">
                            <h2 className="text-xl font-extrabold text-foreground">Notifications</h2>
                            {pool.some((i) => !i.read_at) && (
                                <button
                                    type="button"
                                    onClick={markAllRead}
                                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                                >
                                    Mark all as read
                                </button>
                            )}
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 px-4 pb-2">
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

                        {notice && <p className="px-4 pb-2 text-xs font-semibold text-rose-500">{notice}</p>}

                        {/* List (older notifications load as you scroll down) */}
                        <div className="max-h-[70vh] overflow-y-auto px-2 pb-2" onScroll={onListScroll}>
                            {loading && items.length === 0 ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="animate-spin text-muted-foreground" size={22} />
                                </div>
                            ) : loadError ? (
                                <p className="text-center text-sm text-rose-500 py-10">
                                    Couldn&apos;t load notifications. Try again.
                                </p>
                            ) : visible.length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground py-10">
                                    {isArchivedTab
                                        ? "No archived notifications."
                                        : tab === "unread" || isAdminTab
                                            ? "You're all caught up."
                                            : "Nothing here yet."}
                                </p>
                            ) : isArchivedTab ? (
                                <>{visible.map(renderRow)}</>
                            ) : isAdminTab ? (
                                <>
                                    <p className="px-3 pt-2 pb-2 text-xs text-muted-foreground">
                                        {adminPending === 0
                                            ? "Nothing is waiting for you."
                                            : `${adminPending} ${adminPending === 1 ? "item needs" : "items need"} your attention`}
                                    </p>
                                    {kindsPresent.length > 1 && (
                                        <div className="flex flex-wrap gap-1.5 px-3 pb-1">
                                            {[["all", "All", adminPending], ...kindsPresent.map((k) => [
                                                k,
                                                ADMIN_KINDS[k].label,
                                                adminItems.filter((i) => kindKeyOf(i, reportInfo) === k && !adminStates[i.id]?.resolved).length,
                                            ])].map(([key, label, n]) => (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => setAdminFilter(key)}
                                                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${activeFilter === key
                                                            ? key === "all"
                                                                ? "bg-purple-500/15 text-purple-500 dark:text-purple-400"
                                                                : ADMIN_KINDS[key].chip
                                                            : "bg-muted text-muted-foreground hover:text-foreground"
                                                        }`}
                                                >
                                                    {label} ({n})
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {renderAdminGroups(adminItems.filter((i) => !isOlderPage(i)))}
                                    {adminItems.some(isOlderPage) && (
                                        <>
                                            <p className="mt-5 px-3 pt-3 pb-1 text-sm font-bold text-foreground border-t border-border">
                                                Older notifications
                                            </p>
                                            {renderAdminGroups(adminItems.filter(isOlderPage))}
                                        </>
                                    )}
                                </>
                            ) : (
                                <>
                                    {todayItems.length > 0 && (
                                        <>
                                            <p className="px-3 pt-2 pb-1 text-sm font-bold text-foreground">Today</p>
                                            {todayItems.map(renderRow)}
                                        </>
                                    )}
                                    {olderItems.length > 0 && (
                                        <>
                                            <p className="px-3 pt-3 pb-1 text-sm font-bold text-foreground">Older</p>
                                            {olderItems.map(renderRow)}
                                        </>
                                    )}
                                </>
                            )}

                            {hasMore ? (
                                <div className="flex justify-center py-3">
                                    <button
                                        type="button"
                                        onClick={() => load(true)}
                                        disabled={loadingMore}
                                        className="px-4 py-2 rounded-full text-sm font-semibold text-foreground bg-muted hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer flex items-center gap-2"
                                    >
                                        {loadingMore && <Loader2 className="animate-spin" size={16} />}
                                        {loadingMore ? "Loading..." : "Load older notifications"}
                                    </button>
                                </div>
                            ) : items.length >= PAGE_SIZE ? (
                                <p className="text-center text-xs text-muted-foreground py-3">
                                    You&apos;ve reached the end.
                                </p>
                            ) : null}
                        </div>

                        {/* Footer */}
                        <div className="p-2 border-t border-border">
                            <Link
                                href="/notifications"
                                onClick={() => setOpen(false)}
                                className="block w-full text-center py-2.5 rounded-lg text-sm font-semibold text-foreground bg-muted hover:opacity-90 transition-opacity"
                            >
                                See all notifications
                            </Link>
                        </div>

                        {menu &&
                            (() => {
                                const item = items.find((i) => i.id === menu.id);
                                if (!item) return null;
                                const isArchived = archived.has(item.id);
                                const rowCls =
                                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-left hover:bg-muted transition-colors cursor-pointer";
                                return (
                                    <div
                                        data-notif-menu
                                        role="menu"
                                        style={{ top: menu.top, left: menu.left }}
                                        className="fixed z-30 w-48 rounded-xl border border-border bg-background p-1 shadow-2xl"
                                    >
                                        <button
                                            type="button"
                                            role="menuitem"
                                            className={`${rowCls} text-foreground`}
                                            onClick={() => {
                                                setMenu(null);
                                                setRead(item, !item.read_at);
                                            }}
                                        >
                                            {item.read_at ? <Mail size={16} /> : <MailOpen size={16} />}
                                            {item.read_at ? "Mark as unread" : "Mark as read"}
                                        </button>
                                        <button
                                            type="button"
                                            role="menuitem"
                                            className={`${rowCls} text-foreground`}
                                            onClick={() => {
                                                setMenu(null);
                                                toggleArchive(item);
                                            }}
                                        >
                                            {isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                                            {isArchived ? "Unarchive" : "Archive"}
                                        </button>
                                        <button
                                            type="button"
                                            role="menuitem"
                                            className={`${rowCls} text-rose-500`}
                                            onClick={() => {
                                                setMenu(null);
                                                deleteItem(item);
                                            }}
                                        >
                                            <Trash2 size={16} />
                                            Delete notification
                                        </button>
                                    </div>
                                );
                            })()}
                    </div>
                </>
            )}

            {/* PAYMENT REQUIRED POPUP (merch drop notifications).
          Rendered in a portal so it centers on the screen and isn't hidden with the bell on small screens. */}
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
                                    <h2
                                        id="payment-required-title"
                                        className="text-lg font-black uppercase tracking-wide"
                                    >
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