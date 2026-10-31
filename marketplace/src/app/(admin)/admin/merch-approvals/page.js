"use client";

import { toast } from "sonner";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { isMerch } from "@/lib/merch";
import { Loader2, CheckCircle2, XCircle, ShieldCheck, Layers, Calendar, Tag } from "lucide-react";
import { ui, btn } from "../ui";

// Popup text for each action
const CONFIRM_COPY = {
    approve: {
        title: "Approve & publish?",
        message: (name) => `Confirm the listing payment for "${name}" and publish it to the merchandise page?`,
        confirmText: "Approve & Publish",
    },
    reject: {
        title: "Reject this merchandise?",
        message: (name) => `"${name}" will be marked as rejected and removed from the approval queue.`,
        confirmText: "Reject",
    },
};

// Applicant avatar: shows the profile photo, or initials if there is none
function ApplicantAvatar({ name, src, size = 32 }) {
    const [failed, setFailed] = useState(false);

    const initials = (name || "?")
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    if (src && !failed) {
        return (
            <img
                src={src}
                alt={name || "Applicant"}
                style={{ width: size, height: size }}
                className="rounded-full object-cover border border-line shrink-0"
                onError={() => setFailed(true)}
            />
        );
    }

    return (
        <div
            style={{ width: size, height: size }}
            className="rounded-full bg-brand/10 text-brand border border-line flex items-center justify-center text-[11px] font-bold shrink-0"
        >
            {initials}
        </div>
    );
}

export default function AdminMerchApprovals() {
    const [pendingItems, setPendingItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null); // { item, type: "approve" | "reject" }
    const [rejectReason, setRejectReason] = useState("");

    useEffect(() => {
        fetchPendingMerch();
    }, []);

    // Close the popup with the Escape key
    useEffect(() => {
        if (!confirmAction) return;
        const onKey = (e) => e.key === "Escape" && closeConfirm();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [confirmAction, processingId]);

    const fetchPendingMerch = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("products")
                .select(`
          *,
          profiles(full_name, org_name, avatar_url),
          categories(name)
        `)
                .eq("status", "pending")
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Fetch error:", error);
                toast.error("Failed to load pending items: " + error.message);
            } else {
                setPendingItems((data || []).filter((p) => isMerch(p)));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const approveMerchDrop = async (item) => {
        setProcessingId(item.id);
        const { error } = await supabase.rpc("approve_merch_drop", {
            p_product_id: item.id,
        });

        if (error) {
            console.error("Approval error:", error);
            toast.error("Failed to approve item: " + error.message);
        } else {
            setPendingItems((prev) => prev.filter((p) => p.id !== item.id));
        }
        setProcessingId(null);
    };

    const rejectMerchDrop = async (productId, reason) => {
        setProcessingId(productId);
        try {
            const { error } = await supabase.rpc("moderate_reject_merch", {
                p_product_id: productId,
                p_reason: reason,
            });
            if (error) throw error;
            setPendingItems((prev) => prev.filter((item) => item.id !== productId));
        } catch (err) {
            console.error("Rejection error:", err);
            toast.error("Failed to reject item: " + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    // ---- confirmation popup helpers ----
    const requestAction = (item, type) => { setRejectReason(""); setConfirmAction({ item, type }); };

    const closeConfirm = () => {
        if (!processingId) setConfirmAction(null);
    };

    const handleConfirm = async () => {
        const { item, type } = confirmAction;
        if (type === "approve") await approveMerchDrop(item);
        else await rejectMerchDrop(item.id, rejectReason.trim());
        setConfirmAction(null);
    };

    if (loading) return (
        <div className="min-h-[300px] flex items-center justify-center">
            <Loader2 className="animate-spin text-brand" size={32} />
        </div>
    );

    return (
        <div className="text-foreground overflow-x-hidden">
            <div className={ui.page}>

                <div className={`${ui.headerBar} gap-3`}>
                    <div className="min-w-0">
                        <h1 className={ui.title}>
                            <ShieldCheck className={`${ui.titleIcon} shrink-0`} size={28} /> Merchandise Approvals
                        </h1>
                        <p className={ui.subtitle}>
                            Verify GCash listing payments and publish organization drops.
                        </p>
                    </div>
                    <div className={`${ui.countBadge} shrink-0 w-fit`}>
                        {pendingItems.length} Pending
                    </div>
                </div>

                {pendingItems.length === 0 ? (
                    <div className={`${ui.empty} py-12 sm:py-20 px-4`}>
                        <p className="text-sm">
                            No pending merchandise drops awaiting payment review.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:gap-6">
                        {pendingItems.map((item) => {
                            const orgName = item.profiles?.org_name || "Organization";
                            const applicantName = item.profiles?.full_name || "Unknown user";
                            const applicantAvatar = item.profiles?.avatar_url;
                            const categoryName = item.categories?.name;
                            const submitted = item.created_at
                                ? new Date(item.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
                                : "—";
                            const busy = processingId === item.id;

                            return (
                                <article key={item.id} className={`${ui.card} overflow-hidden`}>

                                    {/* Applicant header */}
                                    <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 border-b border-line">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <ApplicantAvatar name={applicantName} src={applicantAvatar} size={40} />
                                            <div className="leading-tight min-w-0">
                                                <p className="text-sm font-bold text-foreground truncate">{applicantName}</p>
                                                <p className="text-xs text-ink-soft truncate">{orgName}</p>
                                            </div>
                                        </div>
                                        <div className="text-right leading-tight shrink-0">
                                            <p className="text-[11px] text-ink-soft">Submitted</p>
                                            <p className="text-xs font-semibold text-foreground whitespace-nowrap">{submitted}</p>
                                        </div>
                                    </div>

                                    {/* Body */}
                                    <div className="p-4 sm:p-6 grid gap-4 sm:gap-6 lg:grid-cols-[1fr_auto] lg:items-center">

                                        {/* Product */}
                                        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                                            <img
                                                src={item.image_urls?.[0] || "/placeholder.png"}
                                                alt={item.title}
                                                className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl object-cover border border-line shrink-0"
                                            />
                                            <div className="min-w-0 space-y-1.5 sm:space-y-2">
                                                {categoryName && (
                                                    <span className="inline-flex max-w-full items-center gap-1 text-[11px] text-ink-soft border border-line rounded-md px-2 py-0.5">
                                                        <Tag size={11} className="shrink-0" />
                                                        <span className="truncate">{categoryName}</span>
                                                    </span>
                                                )}
                                                <h3 className="text-base sm:text-lg font-bold leading-snug text-foreground break-words line-clamp-3">
                                                    {item.title}
                                                </h3>
                                                <p className="text-xl sm:text-2xl font-extrabold text-foreground">
                                                    ₱{item.price}
                                                    <span className="ml-2 text-xs font-semibold text-ink-soft">selling price</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Listing details + actions */}
                                        <div className="flex flex-col gap-3 w-full lg:w-[360px]">
                                            <div className="grid grid-cols-3 divide-x divide-line bg-background border border-line rounded-2xl text-xs">
                                                <div className="p-2.5 sm:p-3 min-w-0">
                                                    <p className="text-[11px] font-semibold text-ink-soft flex items-center gap-1">
                                                        <Layers size={12} className="shrink-0" /> Stock
                                                    </p>
                                                    <p className="font-extrabold text-foreground text-xs sm:text-sm mt-1 break-words">
                                                        {item.stock_quantity || 1} units
                                                    </p>
                                                </div>
                                                <div className="p-2.5 sm:p-3 min-w-0">
                                                    <p className="text-[11px] font-semibold text-ink-soft flex items-center gap-1">
                                                        <Calendar size={12} className="shrink-0" /> Duration
                                                    </p>
                                                    <p className="font-extrabold text-foreground text-xs sm:text-sm mt-1 break-words">
                                                        {item.listing_duration || "N/A"}
                                                    </p>
                                                </div>
                                                <div className="p-2.5 sm:p-3 min-w-0 bg-amber-500/5 rounded-r-2xl">
                                                    <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Listing fee</p>
                                                    <p className="font-black text-amber-600 dark:text-amber-400 text-xs sm:text-sm mt-1 break-words">
                                                        ₱{item.listing_fee || 0}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Stacked on phones so neither button gets squeezed */}
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                                                <button
                                                    onClick={() => requestAction(item, "approve")}
                                                    disabled={busy}
                                                    className={`${btn("primary", "md")} w-full sm:w-auto sm:flex-1 justify-center`}
                                                >
                                                    {busy ? <Loader2 className="animate-spin" size={16} /> : <><CheckCircle2 size={16} /> Approve & Publish</>}
                                                </button>
                                                <button
                                                    title="Reject merchandise"
                                                    onClick={() => requestAction(item, "reject")}
                                                    disabled={busy}
                                                    className={`${btn("dangerOutline", "md")} w-full sm:w-auto justify-center`}
                                                >
                                                    <XCircle size={18} /> Reject
                                                </button>
                                            </div>
                                        </div>

                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}

            </div>

            {/* CONFIRMATION POPUP */}
            {confirmAction && (() => {
                const { item, type } = confirmAction;
                const copy = CONFIRM_COPY[type];
                const busy = processingId === item.id;
                const isApprove = type === "approve";

                return (
                    <div
                        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
                        onClick={closeConfirm}
                    >
                        <div
                            role="dialog"
                            aria-modal="true"
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-line bg-white dark:bg-neutral-900 p-5 sm:p-6 shadow-2xl"
                        >
                            <h2 className="text-lg font-bold text-foreground">{copy.title}</h2>
                            <p className="mt-2 text-sm text-ink-soft break-words">{copy.message(item.title)}</p>

                            {/* Applicant in popup */}
                            <div className="mt-4 flex items-center gap-3 rounded-xl border border-line p-3">
                                <ApplicantAvatar
                                    name={item.profiles?.full_name}
                                    src={item.profiles?.avatar_url}
                                    size={36}
                                />
                                <div className="leading-tight min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">
                                        {item.profiles?.full_name || "Unknown user"}
                                    </p>
                                    <p className="text-xs text-ink-soft truncate">
                                        {item.profiles?.org_name || "Organization"}
                                    </p>
                                </div>
                            </div>

                            {/* Reject reason (required, sent to the seller) */}
                            {type === "reject" && (
                                <div className="mt-4">
                                    <label className="text-xs font-semibold text-ink-soft">Reason (required, shown to the seller)</label>
                                    <textarea
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        maxLength={1000}
                                        rows={3}
                                        placeholder="e.g. We could not verify your GCash payment"
                                        className={`${ui.input} w-full mt-1 text-sm`}
                                    />
                                </div>
                            )}

                            {/* Full-width buttons on phones, confirm on top */}
                            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                                <button
                                    onClick={closeConfirm}
                                    disabled={busy}
                                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl border border-line text-sm font-semibold text-foreground hover:bg-tint transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={busy || (type === "reject" && !rejectReason.trim())}
                                    className={`${btn(isApprove ? "primary" : "dangerOutline", "sm")} w-full sm:w-auto justify-center`}
                                >
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