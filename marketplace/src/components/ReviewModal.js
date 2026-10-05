"use client";

import { toast } from "sonner";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Star, Loader2, X, Pencil } from "lucide-react";
import { sanitizeText, maskTerms } from "@/lib/censor";

const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
const MAX_COMMENT = 500;

export default function ReviewModal({
    transactionId,
    productId,
    reviewerId,
    revieweeId,
    revieweeName,
    roleReviewed = "buyer",
    initialRating = 5,
    initialComment = "",
    existingReviewId = null,
    onClose,
    onSuccess,
}) {
    const [rating, setRating] = useState(initialRating);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState(initialComment);
    const [loading, setLoading] = useState(false);

    const isEditing = Boolean(existingReviewId);
    const shown = hoverRating || rating;
    const roleLabel = roleReviewed === "buyer" ? "Buyer" : "Seller";

    useEffect(() => {
        setRating(initialRating);
        setComment(initialComment);
    }, [initialRating, initialComment, existingReviewId]);

    // Esc closes the modal (unless a save is in progress)
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape" && !loading) onClose?.();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [loading, onClose]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!rating) return toast.error("Please select a rating.");

        setLoading(true);

        // Sanitize profanity (English & Tagalog) before running sentiment or saving to database
        let cleanComment = sanitizeText(comment);

        try {
            let sentiment_label = null;
            let sentiment_score = null;

            // 1. Single-comment sentiment check via Groq
            if (cleanComment && cleanComment.trim().length > 0) {
                try {
                    const aiRes = await fetch("/api/analyze-sentiment", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ comment: cleanComment }),
                    });
                    const aiData = await aiRes.json();
                    if (aiData.label) {
                        sentiment_label = aiData.label;
                        sentiment_score = aiData.score;
                    }
                    if (Array.isArray(aiData.profane_terms) && aiData.profane_terms.length > 0) {
                        cleanComment = maskTerms(cleanComment, aiData.profane_terms);
                    }
                } catch (err) {
                    console.error("AI analysis skipped:", err);
                }
            }

            let error;

            // 2. Save or update sanitized review in Supabase
            if (isEditing) {
                const res = await supabase
                    .from("reviews")
                    .update({
                        rating,
                        comment: cleanComment,
                        sentiment_label,
                        sentiment_score,
                    })
                    .eq("id", existingReviewId);
                error = res.error;
            } else {
                const res = await supabase.from("reviews").insert([
                    {
                        transaction_id: transactionId,
                        product_id: productId,
                        reviewer_id: reviewerId,
                        reviewee_id: revieweeId,
                        rating,
                        comment: cleanComment,
                        role_reviewed: roleReviewed,
                        sentiment_label,
                        sentiment_score,
                    },
                ]);
                error = res.error;
            }

            if (error) throw error;

            // 3. Delegate seller summary generation and profile update entirely to the server
            if (roleReviewed === "seller" && revieweeId) {
                try {
                    await fetch("/api/summarize-reviews", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sellerId: revieweeId }),
                    });
                } catch (summaryErr) {
                    console.error("Failed to trigger seller summary update:", summaryErr);
                }
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error("Review submission error:", err);
            toast.error(err.message || "Failed to submit review.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !loading) onClose?.();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="review-modal-title"
                className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-stone-300 bg-white p-6 text-foreground shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
            >
                <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    aria-label="Close"
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-stone-200 hover:text-foreground disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
                >
                    <X size={18} />
                </button>

                <h3 id="review-modal-title" className="mb-1 flex items-center gap-2 pr-8 text-xl font-black tracking-tight">
                    {isEditing && <Pencil size={18} className="text-emerald-600 dark:text-emerald-400" />}
                    {isEditing ? `Edit review for ${roleLabel}` : `Review ${roleLabel}`}
                </h3>
                <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
                    Share your experience transacting with{" "}
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">{revieweeName}</span>.
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Rating */}
                    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-stone-300 bg-stone-100 py-4 dark:border-neutral-700 dark:bg-neutral-800/60">
                        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    role="radio"
                                    aria-checked={rating === star}
                                    aria-label={`${star} star${star === 1 ? "" : "s"}`}
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    className="rounded-md p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                                >
                                    <Star
                                        size={30}
                                        className={
                                            shown >= star
                                                ? "fill-amber-400 text-amber-500"
                                                : "text-stone-400 dark:text-neutral-600"
                                        }
                                    />
                                </button>
                            ))}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                            {RATING_LABELS[shown] || "Select a rating"}
                            {shown ? ` · ${shown}/5` : ""}
                        </span>
                    </div>

                    {/* Comment */}
                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <label
                                htmlFor="review-comment"
                                className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400"
                            >
                                Comment <span className="font-medium normal-case text-neutral-400">(optional)</span>
                            </label>
                            <span className="text-[11px] text-neutral-400">
                                {comment.length}/{MAX_COMMENT}
                            </span>
                        </div>
                        <textarea
                            id="review-comment"
                            rows={4}
                            maxLength={MAX_COMMENT}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder={
                                roleReviewed === "buyer"
                                    ? "Was the buyer punctual, responsive, and easy to deal with?"
                                    : "How was the item quality and communication from the seller?"
                            }
                            className="select-text w-full resize-none rounded-xl border border-stone-400 bg-stone-50 p-3 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-500 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/30 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:placeholder:text-neutral-400 dark:focus:border-emerald-600"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="rounded-xl border border-stone-400 bg-stone-200 px-5 py-3 text-sm font-bold text-neutral-800 transition-colors hover:bg-stone-300 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-600 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-60 dark:border-emerald-600 dark:bg-emerald-700 dark:hover:bg-emerald-800"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} /> Saving...
                                </>
                            ) : isEditing ? (
                                "Update Review"
                            ) : (
                                "Submit Review"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}