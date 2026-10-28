"use client";

import { toast } from "sonner";
import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { isMerch } from "@/lib/merch";
import {
    Loader2,
    Flag,
    CheckCircle2,
    Trash2,
    ExternalLink,
    Clock,
    AlertTriangle,
    Package,
    Search,
    ArrowRight,
    ScanSearch,
} from "lucide-react";
import { ui, btn } from "../ui";

const REASON_LABELS = {
    moderation_unavailable: "The automatic check was unavailable, so this needs a manual look.",
    unclear_result: "The automatic check gave an unclear result, so this needs a manual look.",
    could_not_read_image: "This photo could not be read by the automatic check.",
};

// Popup text for each action
const CONFIRM_COPY = {
    approve: {
        title: "Approve this listing?",
        message: (name) => `"${name}" will be restored and become visible again.`,
        confirmText: "Approve listing",
        style: "primary",
    },
    remove: {
        title: "Remove this listing?",
        message: (name) => `"${name}" will be taken down and the seller won't be able to relist it from here.`,
        confirmText: "Remove listing",
        style: "danger",
    },
};

function Avatar({ name, url, size = 36 }) {
    const initials =
        name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
    return url ? (
        <img
            src={url}
            alt=""
            style={{ width: size, height: size }}
            className="rounded-full object-cover shrink-0 border border-line bg-tint"
        />
    ) : (
        <div
            style={{ width: size, height: size }}
            className="rounded-full shrink-0 flex items-center justify-center bg-tint text-ink-soft text-[11px] font-black border border-line"
        >
            {initials}
        </div>
    );
}

function FlaggedContent() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [processingId, setProcessingId] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null); // { group, action: "approve" | "remove" }

    // ---- Jump to a specific listing (from the notification bell: ?product=<id>) ----
    const searchParams = useSearchParams();
    const targetId = searchParams?.get("product") ?? null;
    const [highlightId, setHighlightId] = useState(null);
    const handledRef = useRef(null);

    useEffect(() => {
        fetchFlags();
    }, []);

    // Close the popup with the Escape key
    useEffect(() => {
        if (!confirmAction) return;
        const onKey = (e) => e.key === "Escape" && closeConfirm();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [confirmAction, processingId]);

    // Highlight the listing from the notification once the list has loaded
    useEffect(() => {
        if (!targetId || loading || handledRef.current === targetId) return;
        handledRef.current = targetId;
        if (groups.some((g) => String(g.productId) === targetId)) {
            setSearch("");
            setHighlightId(targetId);
        } else {
            toast.info("That listing was already reviewed, or is no longer flagged.");
        }
    }, [targetId, groups, loading]);

    // Scroll to it, then fade the highlight
    useEffect(() => {
        if (!highlightId) return;
        const t1 = setTimeout(() => {
            document.getElementById(`flagged-${highlightId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 150);
        const t2 = setTimeout(() => setHighlightId(null), 6000);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, [highlightId]);

    async function fetchFlags() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("moderation_flags")
                .select(`
          id, product_id, image_url, categories, reason, created_at,
          products ( id, title, price, tags, status, image_urls, expires_at, stock_quantity, profiles ( full_name, email, avatar_url ) )
        `)
                .eq("status", "pending")
                .order("created_at", { ascending: false });

            if (error) throw error;

            // One card per listing, even if several of its photos were flagged
            const byProduct = new Map();
            for (const flag of data || []) {
                if (!byProduct.has(flag.product_id)) {
                    byProduct.set(flag.product_id, {
                        productId: flag.product_id,
                        product: flag.products,
                        flags: [],
                    });
                }
                byProduct.get(flag.product_id).flags.push(flag);
            }
            setGroups([...byProduct.values()]);
        } catch (err) {
            console.error("Error loading flagged listings:", err);
        } finally {
            setLoading(false);
        }
    }

    const resolveGroup = async (group, action) => {
        setProcessingId(group.productId);
        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            // Restore the listing to the state it would have had without the flag
            const cleanTags = Array.isArray(group.product?.tags)
                ? group.product.tags.filter((t) => String(t).toLowerCase() !== "flagged")
                : null;
            const p = group.product;
            const merch = isMerch(p);
            const hasExpiry = !!p?.expires_at;
            const stillPaid = hasExpiry && new Date(p.expires_at) > new Date();

            let restored;
            if (!merch) restored = { status: "active", is_available: true };
            else if (stillPaid) restored = { status: "active", is_available: (p.stock_quantity ?? 0) > 0 };
            else if (!hasExpiry) restored = { status: "pending", is_available: false };
            else restored = { status: "expired", is_available: false };

            const productUpdate =
                action === "approve"
                    ? { ...restored, is_published: true, ...(cleanTags ? { tags: cleanTags } : {}) }
                    : { status: "rejected", is_published: false, is_available: false };
            const { data: updated, error: productError } = await supabase
                .from("products")
                .update(productUpdate)
                .eq("id", group.productId)
                .select("id");

            if (productError) throw productError;
            if (!updated || updated.length === 0) {
                throw new Error("The listing was not updated. Check the update permissions (RLS) on the products table.");
            }

            const { error: flagError } = await supabase
                .from("moderation_flags")
                .update({
                    status: action === "approve" ? "dismissed" : "removed",
                    reviewed_by: session?.user?.id ?? null,
                    reviewed_at: new Date().toISOString(),
                })
                .eq("product_id", group.productId)
                .eq("status", "pending");

            if (flagError) throw flagError;

            setGroups((prev) => prev.filter((g) => g.productId !== group.productId));
        } catch (err) {
            console.error("Moderation action failed:", err);
            toast.error("Could not update this listing: " + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    // ---- confirmation popup helpers ----
    const requestAction = (group, action) => setConfirmAction({ group, action });

    const closeConfirm = () => {
        if (!processingId) setConfirmAction(null);
    };

    const handleConfirm = async () => {
        const { group, action } = confirmAction;
        await resolveGroup(group, action);
        setConfirmAction(null);
    };

    const query = search.trim().toLowerCase();
    const filteredGroups = groups.filter((g) => {
        if (!query) return true;
        const seller = g.product?.profiles;
        const haystack = [
            g.product?.title,
            seller?.full_name,
            seller?.email,
            ...g.flags.flatMap((f) => [...(f.categories || []), f.reason]),
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
        return haystack.includes(query);
    });

    if (loading) {
        return (
            <div className="min-h-[300px] flex items-center justify-center">
                <Loader2 className="animate-spin text-brand" size={32} />
            </div>
        );
    }

    return (
        <div className="text-foreground">
            <div className={ui.page}>
                {/* HEADER SECTION */}
                <div className={ui.headerBar}>
                    <div>
                        <h1 className={ui.title}>
                            <Flag className={ui.titleIcon} size={28} /> Flagged Content
                        </h1>
                        <p className={ui.subtitle}>
                            These listings are hidden until a moderator reviews the photos below.
                        </p>
                    </div>
                    <div className={ui.countBadge}>{groups.length} Pending</div>
                </div>

                {/* SEARCH */}
                <div className="relative">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by item, seller, category or reason..."
                        className={`${ui.input} w-full pl-10 text-xs`}
                    />
                </div>

                {/* QUEUE CONTENT */}
                {filteredGroups.length === 0 ? (
                    <div className="border border-line rounded-2xl bg-surface p-16 text-center flex flex-col items-center justify-center min-h-[350px] shadow-sm space-y-2">
                        <CheckCircle2 size={48} className="text-ink-soft/40 mb-2" />
                        <h3 className="text-base font-bold text-foreground">Queue Cleared</h3>
                        <p className="text-sm text-ink-soft">
                            {query ? "No flagged listings match your search." : "Nothing to review. Flagged listings will show up here."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredGroups.map((group) => {
                            const product = group.product;
                            const seller = product?.profiles;
                            const sellerName = seller?.full_name || seller?.email || "Unknown seller";
                            const busy = processingId === group.productId;
                            const productImage = product?.image_urls?.[0];
                            const title = product?.title || "Listing not visible to you";
                            const flaggedAt = group.flags.reduce(
                                (latest, f) => (new Date(f.created_at) > new Date(latest) ? f.created_at : latest),
                                group.flags[0].created_at
                            );
                            const reasons = [
                                ...new Set(
                                    group.flags.map((f) => REASON_LABELS[f.reason] || f.reason).filter(Boolean)
                                ),
                            ];
                            const categories = [...new Set(group.flags.flatMap((f) => f.categories || []))];

                            return (
                                <div
                                    key={group.productId}
                                    id={`flagged-${group.productId}`}
                                    className={`bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4 transition-all ${busy ? "opacity-50 pointer-events-none" : ""
                                        } ${String(highlightId) === String(group.productId) ? "animate-pulse" : ""}`}
                                    style={
                                        String(highlightId) === String(group.productId)
                                            ? { boxShadow: "0 0 0 3px #f43f5e, 0 0 0 7px rgba(244,63,94,0.25), 0 0 28px rgba(244,63,94,0.45)" }
                                            : undefined
                                    }
                                >
                                    {/* CARD HEADER */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="p-2 rounded-xl border bg-rose-500/10 text-rose-600 border-rose-500/20">
                                                <AlertTriangle size={18} />
                                            </span>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-bold text-foreground truncate">
                                                    Flagged Listing:{" "}
                                                    <span className="text-rose-600 dark:text-rose-400">{title}</span>
                                                </h4>
                                                <p className="text-xs text-ink-soft flex items-center gap-2 mt-0.5">
                                                    <span>
                                                        {group.flags.length} flagged {group.flags.length === 1 ? "photo" : "photos"}
                                                    </span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={12} /> {new Date(flaggedAt).toLocaleString()}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border w-fit bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                                            pending
                                        </span>
                                    </div>

                                    {/* FLAGGED ITEM */}
                                    <div className="flex gap-4 p-3 rounded-xl border border-line bg-tint">
                                        {group.productId ? (
                                            <Link href={`/products/${group.productId}`} className="shrink-0">
                                                {productImage ? (
                                                    <img
                                                        src={productImage}
                                                        alt={title}
                                                        className="w-24 h-24 rounded-xl object-cover border border-line bg-surface"
                                                    />
                                                ) : (
                                                    <div className="w-24 h-24 rounded-xl border border-line bg-surface flex items-center justify-center text-ink-soft">
                                                        <Package size={28} />
                                                    </div>
                                                )}
                                            </Link>
                                        ) : null}
                                        <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-ink-soft">Flagged item</p>
                                            <Link
                                                href={`/products/${group.productId}`}
                                                className="text-base font-bold text-foreground hover:underline line-clamp-2"
                                            >
                                                {title}
                                            </Link>
                                            {product?.price != null && (
                                                <p className="text-sm font-semibold text-foreground">₱{product.price}</p>
                                            )}
                                            {product?.status && (
                                                <span className="w-fit px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-line bg-surface text-ink-soft">
                                                    Listing {String(product.status).replaceAll("_", " ")}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* SELLER */}
                                    <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
                                        <div className="flex-1 min-w-0 flex items-center gap-3 p-3 rounded-xl border border-line bg-tint">
                                            <ScanSearch size={20} className="text-ink-soft shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-ink-soft">Flagged by</p>
                                                <p className="text-sm font-bold text-foreground">Automatic photo check</p>
                                            </div>
                                        </div>
                                        <div className="hidden sm:flex items-center text-ink-soft">
                                            <ArrowRight size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0 flex items-center gap-3 p-3 rounded-xl border border-rose-500/25 bg-rose-500/5">
                                            <Avatar name={sellerName} url={seller?.avatar_url} size={40} />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-ink-soft">Seller</p>
                                                <p className="text-sm font-bold text-foreground truncate">{sellerName}</p>
                                                {seller?.email && seller?.full_name && (
                                                    <p className="text-[11px] text-ink-soft truncate">{seller.email}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* REASON BOX */}
                                    <div className="p-3.5 rounded-xl bg-tint border border-line space-y-2">
                                        <p className="text-xs font-bold text-ink-soft uppercase tracking-wider">
                                            Flag Reason / Details
                                        </p>
                                        {categories.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {categories.map((category) => (
                                                    <span
                                                        key={category}
                                                        className="px-2 py-0.5 bg-rose-500/10 text-rose-500 border border-rose-500/30 rounded-md text-[10px] font-bold"
                                                    >
                                                        {category}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-line font-medium">
                                            {reasons.length > 0 ? reasons.join("\n") : "No reason given."}
                                        </p>
                                    </div>

                                    {/* FLAGGED PHOTOS */}
                                    <div>
                                        <p className="text-xs font-bold text-ink-soft uppercase tracking-wider mb-2">
                                            Flagged Photos
                                        </p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {group.flags.map((flag) => (
                                                <a
                                                    key={flag.id}
                                                    href={flag.image_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="group relative block rounded-xl overflow-hidden border border-line bg-tint"
                                                >
                                                    <img
                                                        src={flag.image_url}
                                                        alt="Flagged photo"
                                                        className="w-full h-32 object-cover"
                                                    />
                                                    <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <ExternalLink size={10} /> Full size
                                                    </span>
                                                </a>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ACTION BUTTONS & LINKS */}
                                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                        <Link href={`/products/${group.productId}`} className={btn("outline", "sm")}>
                                            <Package size={14} /> Inspect Product Listing <ExternalLink size={12} />
                                        </Link>

                                        <div className="flex flex-wrap items-center gap-2 ml-auto">
                                            <button
                                                onClick={() => requestAction(group, "remove")}
                                                disabled={busy}
                                                className={btn("dangerOutline", "sm")}
                                            >
                                                <Trash2 size={14} /> Remove Listing
                                            </button>
                                            <button
                                                onClick={() => requestAction(group, "approve")}
                                                disabled={busy}
                                                className={btn("primary", "sm")}
                                            >
                                                {busy ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                                                Approve Listing
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* CONFIRMATION POPUP */}
            {confirmAction && (() => {
                const { group, action } = confirmAction;
                const copy = CONFIRM_COPY[action];
                const busy = processingId === group.productId;
                const name = group.product?.title || "This listing";

                return (
                    <div
                        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={closeConfirm}
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md rounded-2xl border border-line bg-surface text-foreground p-6 shadow-2xl"
                        >
                            <h2 className="text-lg font-bold mb-1">{copy.title}</h2>
                            <p className="text-sm text-ink-soft mb-6">{copy.message(name)}</p>

                            <div className="flex justify-end gap-3">
                                <button onClick={closeConfirm} disabled={busy} className={btn("outline", "sm")}>
                                    Cancel
                                </button>
                                <button onClick={handleConfirm} disabled={busy} className={btn(copy.style, "sm")}>
                                    {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                                    {copy.confirmText}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

export default function AdminFlaggedPage() {
    return (
        <Suspense fallback={null}>
            <FlaggedContent />
        </Suspense>
    );
}