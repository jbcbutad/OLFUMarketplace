"use client";

import { useConfirm } from "@/components/ConfirmProvider";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Loader2, Flag, CheckCircle2, Trash2, ExternalLink } from "lucide-react";
import { ui, btn } from "../ui";

const REASON_LABELS = {
    moderation_unavailable: "The automatic check was unavailable, so this needs a manual look.",
    unclear_result: "The automatic check gave an unclear result, so this needs a manual look.",
    could_not_read_image: "This photo could not be read by the automatic check.",
};

export default function AdminFlaggedPage() {
    const askConfirm = useConfirm();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        fetchFlags();
    }, []);

    async function fetchFlags() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("moderation_flags")
                .select(`
          id, product_id, image_url, categories, reason, created_at,
          products ( id, title, price, tags, status, profiles ( full_name, email ) )
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
        if (
            action === "remove" &&
            !(await askConfirm({
                title: "Remove this listing?",
                message: "It will be taken down and the seller won't be able to relist it from here.",
                confirmText: "Remove listing",
            }))
        ) {
            return;
        }

        setProcessingId(group.productId);
        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            // Restore the listing to the state it would have had without the flag
            const isMerch = Array.isArray(group.product?.tags) && group.product.tags.includes("official-merch");
            const productUpdate =
                action === "approve"
                    ? { status: isMerch ? "pending" : "active", is_published: true, is_available: true }
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
                <div className={ui.headerBar}>
                    <div>
                        <h1 className={ui.title}>
                            <Flag className={ui.titleIcon} size={28} /> Flagged Content
                        </h1>
                        <p className={ui.subtitle}>
                            These listings are hidden until a moderator reviews the photos below.
                        </p>
                    </div>
                    <div className={ui.countBadge}>
                        {groups.length} Pending
                    </div>
                </div>

                {groups.length === 0 ? (
                    <div className={`${ui.empty} py-20`}>
                        <p className="text-sm">
                            Nothing to review. Flagged listings will show up here.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {groups.map((group) => {
                            const product = group.product;
                            const seller = product?.profiles;
                            const busy = processingId === group.productId;

                            return (
                                <div
                                    key={group.productId}
                                    className={`${ui.card} p-6 space-y-5`}
                                >
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                        <div className="space-y-1 min-w-0">
                                            <h3 className="text-lg font-bold text-foreground truncate">
                                                {product?.title || "Listing not visible to you"}
                                            </h3>
                                            <p className="text-xs text-ink-soft">
                                                Seller:{" "}
                                                <span className="text-foreground font-semibold">
                                                    {seller?.full_name || seller?.email || "Unknown"}
                                                </span>
                                                {product?.price != null && (
                                                    <>
                                                        {" "}| Price:{" "}
                                                        <span className="text-foreground font-semibold">₱{product.price}</span>
                                                    </>
                                                )}
                                            </p>
                                            <p className="text-xs text-ink-soft">
                                                {group.flags.length} flagged {group.flags.length === 1 ? "photo" : "photos"}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                onClick={() => resolveGroup(group, "approve")}
                                                disabled={busy}
                                                className={btn("primary", "sm")}
                                            >
                                                {busy ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                                                Approve listing
                                            </button>
                                            <button
                                                onClick={() => resolveGroup(group, "remove")}
                                                disabled={busy}
                                                className={btn("dangerOutline", "sm")}
                                            >
                                                <Trash2 size={14} /> Remove listing
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {group.flags.map((flag) => (
                                            <div
                                                key={flag.id}
                                                className="flex gap-3 p-3 bg-tint border border-line rounded-xl"
                                            >
                                                <a
                                                    href={flag.image_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="shrink-0"
                                                >
                                                    <img
                                                        src={flag.image_url}
                                                        alt="Flagged photo"
                                                        className="w-24 h-24 object-cover rounded-lg border border-line"
                                                    />
                                                </a>
                                                <div className="space-y-1.5 min-w-0">
                                                    {(flag.categories || []).length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {flag.categories.map((category) => (
                                                                <span
                                                                    key={category}
                                                                    className="px-2 py-0.5 bg-rose-500/10 text-rose-500 border border-rose-500/30 rounded-md text-[10px] font-bold"
                                                                >
                                                                    {category}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-ink-soft">
                                                        {REASON_LABELS[flag.reason] || flag.reason || "No reason given."}
                                                    </p>
                                                    <a
                                                        href={flag.image_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand underline underline-offset-2"
                                                    >
                                                        <ExternalLink size={11} /> Open full size
                                                    </a>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}