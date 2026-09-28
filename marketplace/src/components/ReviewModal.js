"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Star, Loader2, X, Pencil } from "lucide-react";
import { sanitizeText } from "@/lib/censor";

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

    useEffect(() => {
        setRating(initialRating);
        setComment(initialComment);
    }, [initialRating, initialComment, existingReviewId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!rating) return alert("Please select a rating.");

        setLoading(true);

        // Sanitize profanity (English & Tagalog) before running sentiment or saving to database
        const cleanComment = sanitizeText(comment);

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
            alert(err.message || "Failed to submit review.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative text-foreground">
                <button onClick={onClose} className="absolute top-4 right-4 text-neutral-400 hover:text-foreground">
                    <X size={20} />
                </button>

                <h3 className="text-xl font-bold mb-1 flex items-center gap-2">
                    {isEditing && <Pencil size={18} className="text-yellow-500" />}
                    {isEditing ? "Edit Review for" : "Review"} {roleReviewed === "buyer" ? "Buyer" : "Seller"}
                </h3>
                <p className="text-xs text-neutral-400 mb-6">
                    Share your experience transacting with <span className="text-yellow-500 font-semibold">{revieweeName}</span>.
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="flex flex-col items-center justify-center gap-2 py-2 bg-neutral-800/50 rounded-2xl border border-neutral-800">
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoverRating(star)}
                                    onMouseLeave={() => setHoverRating(0)}
                                    className="p-1 transition-transform hover:scale-110"
                                >
                                    <Star
                                        size={28}
                                        className={`${(hoverRating || rating) >= star
                                            ? "fill-yellow-500 text-yellow-500"
                                            : "text-neutral-600"
                                            }`}
                                    />
                                </button>
                            ))}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                            {rating} Out of 5 Stars
                        </span>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block mb-2">
                            Comment
                        </label>
                        <textarea
                            rows="3"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder={
                                roleReviewed === "buyer"
                                    ? "Was the buyer punctual, responsive, and easy to deal with?"
                                    : "How was the item quality and communication from the seller?"
                            }
                            className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-3 text-xs text-foreground outline-none focus:border-yellow-500 resize-none"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : isEditing ? "Update Review" : "Submit Review"}
                    </button>
                </form>
            </div>
        </div>
    );
}