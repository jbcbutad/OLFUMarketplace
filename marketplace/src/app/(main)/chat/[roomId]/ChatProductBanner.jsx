"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Star, Pencil } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { getListingState } from "@/lib/listingStatus";
import { isMerch } from "@/lib/merch";
import MarkAsTransactedModal from "@/components/MarkAsTransactedModal";
import ReviewModal from "@/components/ReviewModal";

// Same pill look as the Purchase / Sales History pages.
const PILL_BASE = "text-[10px] font-black uppercase px-2 py-0.5 rounded border shrink-0";
const PILL_TONES = {
    green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    yellow: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
    orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
    red: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
    neutral: "bg-muted text-muted-foreground border-border",
};

function getPill(state, product, soldLabel) {
    switch (state) {
        case "flagged":
            return { label: "Flagged", tone: "red" };
        case "rejected":
            return { label: "Removed", tone: "red" };
        case "pending_approval":
            return { label: "Awaiting approval", tone: "yellow" };
        case "expired":
            return { label: "Expired", tone: "orange" };
        case "unavailable":
            return soldLabel
                ? { label: soldLabel, tone: "blue" }
                : { label: "Unavailable", tone: "neutral" };
        default:
            return Array.isArray(product.tags) && product.tags.includes("Pending")
                ? { label: "Pending", tone: "yellow" }
                : { label: "Available", tone: "green" };
    }
}

/**
 * Item banner at the top of a chat that was started from a listing.
 *
 * Props
 *  product        listing row from the room (needs seller_id, status, is_available,
 *                 expires_at, tags, stock_quantity, categories(name))
 *  currentUserId  signed-in user's id
 *  otherUser      profile of the person in this chat
 *  otherName      display name of that person
 *  onChanged      called after the listing changes so the parent can refetch it
 *  showToast      the ChatRoom toast helper (message, type)
 */
export default function ChatProductBanner({
    product,
    currentUserId,
    otherUser,
    otherName,
    onChanged,
    showToast,
}) {
    const [tx, setTx] = useState(null); // latest completed transaction I can see for this listing
    const [review, setReview] = useState(null); // my review of that transaction, if any
    const [saleLoaded, setSaleLoaded] = useState(false);
    const [showSell, setShowSell] = useState(false);
    const [showReview, setShowReview] = useState(false);

    const merch = isMerch(product);

    const loadSale = useCallback(async () => {
        // Merchandise keeps its own order flow, so the banner doesn't track a sale for it.
        if (!product?.id || !currentUserId || merch) {
            setTx(null);
            setReview(null);
            setSaleLoaded(true);
            return;
        }

        // RLS limits this to transactions where I'm the buyer or the seller.
        const { data: txRow } = await supabase
            .from("transactions")
            .select("id, buyer_id, seller_id, transaction_type, created_at")
            .eq("product_id", product.id)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        setTx(txRow || null);

        if (txRow) {
            const { data: rv } = await supabase
                .from("reviews")
                .select("id, rating, comment")
                .eq("transaction_id", txRow.id)
                .eq("reviewer_id", currentUserId)
                .maybeSingle();
            setReview(rv || null);
        } else {
            setReview(null);
        }
        setSaleLoaded(true);
    }, [product?.id, product?.status, product?.is_available, currentUserId, merch]);

    useEffect(() => {
        loadSale();
    }, [loadSale]);

    if (!product) return null;

    const isSeller = !!currentUserId && product.seller_id === currentUserId;
    const isRental = Array.isArray(product.tags) && product.tags.includes("Rentals");
    const state = getListingState(product);

    // A sale only counts while the listing is closed. A rental that was made available
    // again goes back to showing "Mark as rented".
    const isSold = state === "unavailable" && !!tx;
    const soldLabel = isSold ? (tx.transaction_type === "rental" ? "Rented" : "Sold") : null;
    const soldToThisChat =
        isSold && (isSeller ? tx.buyer_id === otherUser?.id : tx.buyer_id === currentUserId);

    const canSell = isSeller && !merch && state === "active";
    const canReview = soldToThisChat;

    let saleLine = null;
    if (isSold) {
        if (soldToThisChat) {
            saleLine = isSeller ? `${soldLabel} to ${otherName}` : `${soldLabel} to you`;
        } else if (isSeller) {
            saleLine = `${soldLabel} to another buyer`;
        }
    }

    const pill = getPill(state, product, soldLabel);
    const showPill = state !== "unavailable" || saleLoaded;

    const handleSold = (result) => {
        const { transactionId, buyerId } = result || {};
        const forThisChat = !!transactionId && buyerId === otherUser?.id;

        if (forThisChat) {
            // Open the review straight away; it's skippable, and the button stays on the banner.
            setTx({
                id: transactionId,
                buyer_id: buyerId,
                seller_id: currentUserId,
                transaction_type: isRental ? "rental" : "sale",
            });
            setReview(null);
            setShowReview(true);
            showToast?.(isRental ? "Marked as rented" : "Marked as sold", "success");
        } else {
            showToast?.("Sale recorded. You can review the buyer from Sales History.", "success");
        }
        onChanged?.();
    };

    const reviewTargetId = isSeller ? tx?.buyer_id : product.seller_id;

    return (
        <>
            <div className="px-3 py-3 border-b border-border bg-muted/40 shrink-0">
                <div className="flex flex-wrap items-center gap-3">
                    <Link
                        href={`/products/${product.id}`}
                        className="flex items-center gap-3 flex-1 min-w-[12rem] group"
                    >
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-muted border border-border shrink-0">
                            <img
                                src={product.image_urls?.[0] || "/placeholder.png"}
                                alt={product.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                {showPill && (
                                    <span className={`${PILL_BASE} ${PILL_TONES[pill.tone]}`}>{pill.label}</span>
                                )}
                                {merch && typeof product.stock_quantity === "number" && (
                                    <span className="text-[11px] font-semibold text-muted-foreground">
                                        {product.stock_quantity} in stock
                                    </span>
                                )}
                            </div>
                            <h4 className="text-sm font-bold text-foreground truncate group-hover:underline">
                                {product.title}
                            </h4>
                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                ₱{Number(product.price).toLocaleString()}
                            </p>
                            {saleLine && (
                                <p className="text-[11px] font-semibold text-muted-foreground truncate">
                                    {saleLine}
                                </p>
                            )}
                        </div>
                    </Link>

                    <div className="flex items-center gap-2 shrink-0 ml-auto">
                        {canSell && (
                            <button
                                onClick={() => setShowSell(true)}
                                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl text-xs font-black cursor-pointer shadow-xs transition-colors"
                            >
                                {isRental ? "Mark as rented" : "Mark as sold"}
                            </button>
                        )}

                        {canReview &&
                            (review ? (
                                <button
                                    onClick={() => setShowReview(true)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-accent text-foreground border border-border rounded-xl text-xs font-bold cursor-pointer transition-colors"
                                >
                                    <Pencil size={13} className="text-yellow-500" /> Edit review
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowReview(true)}
                                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                                >
                                    <Star size={14} className="fill-black" />
                                    {isSeller ? "Review buyer" : "Review seller"}
                                </button>
                            ))}
                    </div>
                </div>
            </div>

            {showSell && (
                <MarkAsTransactedModal
                    productId={product.id}
                    sellerId={currentUserId}
                    isRental={isRental}
                    isMerchandise={false}
                    targetStatus="completed"
                    initialBuyerId={otherUser?.id || null}
                    allowExternalClose={false}
                    onSuccess={handleSold}
                    onClose={() => setShowSell(false)}
                />
            )}

            {showReview && tx && reviewTargetId && (
                <ReviewModal
                    transactionId={tx.id}
                    productId={product.id}
                    reviewerId={currentUserId}
                    revieweeId={reviewTargetId}
                    revieweeName={otherName}
                    roleReviewed={isSeller ? "buyer" : "seller"}
                    initialRating={review?.rating || 5}
                    initialComment={review?.comment || ""}
                    existingReviewId={review?.id || null}
                    onClose={() => setShowReview(false)}
                    onSuccess={loadSale}
                />
            )}
        </>
    );
}