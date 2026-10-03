"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, ThumbsUp, ThumbsDown, Sparkles, MessageSquare } from "lucide-react";

// This card uses explicit light/dark colors instead of theme tokens
// (text-foreground, bg-muted, border-border...). The card has its own
// background, so tokens that flip with the page theme end up as white text on
// stone-200 in dark mode. Change the values here to restyle the whole card.
const LINE = "border-stone-400 dark:border-neutral-700";
const TEXT = "text-neutral-900 dark:text-white";
const MUTED = "text-neutral-600 dark:text-neutral-400";
const SURFACE = "bg-stone-100 dark:bg-neutral-800"; // rating boxes, inactive tabs, avatars
const INNER = "bg-stone-100 dark:bg-neutral-800"; // review cards, empty state
const TAB_OFF = `${SURFACE} ${MUTED} ${LINE} hover:text-neutral-900 dark:hover:text-white`;

export default function ProductReviews({ initialReviews = [], aiSummary = null, sellerName = "" }) {
    const [activeTab, setActiveTab] = useState("all");

    const sellerReviews = initialReviews.filter((r) => r.role_reviewed === "seller");
    const buyerReviews = initialReviews.filter((r) => r.role_reviewed === "buyer");

    const calculateAvg = (list) => {
        if (!list.length) return "0.0";
        const sum = list.reduce((acc, r) => acc + Number(r.rating || 0), 0);
        return (sum / list.length).toFixed(1);
    };

    const sellerAvg = calculateAvg(sellerReviews);
    const buyerAvg = calculateAvg(buyerReviews);

    const displayedReviews =
        activeTab === "seller"
            ? sellerReviews
            : activeTab === "buyer"
                ? buyerReviews
                : initialReviews;

    const getBadgeDetails = (rating, sentimentLabel) => {
        const numRating = Number(rating || 0);
        let label = sentimentLabel;
        if (numRating >= 4) label = "Positive";
        else if (numRating <= 2) label = "Negative";

        if (label === "Positive") {
            return { label: "Positive", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
        }
        if (label === "Negative") {
            return { label: "Negative", className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" };
        }
        return label ? { label, className: `${SURFACE} ${MUTED} ${LINE}` } : null;
    };

    // Safely handle aiSummary whether it's an object { summary, pros, cons } or a string
    const summaryText = typeof aiSummary === "string" ? aiSummary : aiSummary?.summary;
    const pros = typeof aiSummary === "object" && Array.isArray(aiSummary?.pros) ? aiSummary.pros : [];
    const cons = typeof aiSummary === "object" && Array.isArray(aiSummary?.cons) ? aiSummary.cons : [];
    const hasAiContent = Boolean(summaryText || pros.length > 0 || cons.length > 0);

    return (
        <div className="bg-stone-200 text-neutral-900 border border-black dark:bg-neutral-900 dark:text-white dark:border-neutral-700 rounded-3xl p-6 sm:p-8 mt-10 shadow-sm transition-colors">
            {/* HEADER & OVERALL RATINGS */}
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b ${LINE}`}>
                <div>
                    <h2 className={`text-2xl font-bold flex items-center gap-2 ${TEXT}`}>
                        {sellerName ? `Ratings and reviews of ${sellerName}` : "Ratings & Reviews"}
                    </h2>
                    <p className={`text-xs ${MUTED} mt-1`}>
                        Community feedback as a buyer and seller
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className={`${SURFACE} border ${LINE} rounded-2xl px-4 py-2 text-center`}>
                        <span className={`text-[10px] font-bold ${MUTED} uppercase tracking-wider block`}>
                            Seller Rating
                        </span>
                        <div className="flex items-center gap-1 mt-0.5 justify-center">
                            <Star size={14} className="fill-amber-400 text-amber-400" />
                            <span className={`text-sm font-extrabold ${TEXT}`}>{sellerAvg}</span>
                            <span className={`text-xs ${MUTED}`}>({sellerReviews.length})</span>
                        </div>
                    </div>

                    <div className={`${SURFACE} border ${LINE} rounded-2xl px-4 py-2 text-center`}>
                        <span className={`text-[10px] font-bold ${MUTED} uppercase tracking-wider block`}>
                            Buyer Rating
                        </span>
                        <div className="flex items-center gap-1 mt-0.5 justify-center">
                            <Star size={14} className="fill-blue-400 text-blue-400" />
                            <span className={`text-sm font-extrabold ${TEXT}`}>{buyerAvg}</span>
                            <span className={`text-xs ${MUTED}`}>({buyerReviews.length})</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* HIGH-IMPACT AI SELLER HIGHLIGHTS */}
            {hasAiContent && (activeTab === "all" || activeTab === "seller") && (
                <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 my-6 bg-gradient-to-br from-amber-500/15 via-purple-500/10 to-transparent border border-amber-500/30 dark:border-amber-400/30 shadow-sm">
                    {/* Background Ambient Glow */}
                    <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10 space-y-3">
                        {/* Header & AI Badge */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-extrabold text-xs uppercase tracking-widest">
                                <Sparkles size={16} className="text-amber-500 shrink-0" />
                                <span>AI Seller Highlights</span>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                                AI Insights
                            </span>
                        </div>

                        {/* Summary Quote */}
                        {summaryText && (
                            <blockquote className={`text-sm font-medium italic ${TEXT} leading-relaxed pl-3.5 border-l-2 border-amber-500`}>
                                "{summaryText}"
                            </blockquote>
                        )}

                        {/* Pros & Cons Tags */}
                        {(pros.length > 0 || cons.length > 0) && (
                            <div className="flex flex-wrap gap-2 pt-1">
                                {pros.map((pro, i) => (
                                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shadow-sm">
                                        <ThumbsUp size={13} className="shrink-0" /> {pro}
                                    </span>
                                ))}
                                {cons.map((con, i) => (
                                    <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30 shadow-sm">
                                        <ThumbsDown size={13} className="shrink-0" /> {con}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* FILTER TABS */}
            <div className="flex flex-wrap gap-2 my-6">
                <button
                    onClick={() => setActiveTab("all")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${activeTab === "all"
                        ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white shadow-sm"
                        : TAB_OFF
                        }`}
                >
                    All ({initialReviews.length})
                </button>
                <button
                    onClick={() => setActiveTab("seller")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${activeTab === "seller"
                        ? "bg-amber-500 text-black border-amber-500 shadow-sm"
                        : TAB_OFF
                        }`}
                >
                    As Seller ({sellerReviews.length})
                </button>
                <button
                    onClick={() => setActiveTab("buyer")}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${activeTab === "buyer"
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : TAB_OFF
                        }`}
                >
                    As Buyer ({buyerReviews.length})
                </button>
            </div>

            {/* REVIEWS LIST WRAPPED IN A SCROLLABLE CONTAINER */}
            <div className="max-h-[480px] overflow-y-auto pr-2 space-y-4 scrollbar-thin">
                {displayedReviews.length === 0 ? (
                    <div className={`p-10 text-center ${MUTED} ${INNER} rounded-2xl border ${LINE} space-y-2`}>
                        <MessageSquare size={32} className="mx-auto text-neutral-400 dark:text-neutral-600" />
                        <p className={`text-sm font-semibold ${TEXT}`}>No reviews found</p>
                        <p className={`text-xs ${MUTED}`}>There is no feedback matching this criteria yet.</p>
                    </div>
                ) : (
                    displayedReviews.map((review) => {
                        const reviewer = review.profiles || review.reviewer || {};
                        const name = reviewer.full_name || `${reviewer.First_Name || ""} ${reviewer.Last_Name || ""}`.trim() || "Anonymous";
                        const reviewerId = reviewer.id || review.reviewer_id;
                        const badge = getBadgeDetails(review.rating, review.sentiment_label);
                        const numericRating = Number(review.rating || 0);

                        return (
                            <div key={review.id} className={`p-4 ${INNER} border ${LINE} rounded-2xl flex flex-col gap-2 shadow-sm`}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        {reviewerId ? (
                                            <Link href={`/profile/${reviewerId}`} className="flex items-center gap-3 group hover:opacity-80 transition-opacity">
                                                <div className={`relative w-9 h-9 rounded-full overflow-hidden ${SURFACE} border ${LINE} shrink-0`}>
                                                    <Image
                                                        src={reviewer.avatar_url || "/placeholder-avatar.png"}
                                                        alt={name}
                                                        fill
                                                        sizes="36px"
                                                        className="object-cover"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs font-bold ${TEXT} group-hover:underline`}>{name}</span>
                                                        <span
                                                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider ${review.role_reviewed === "seller"
                                                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                                                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                                                }`}
                                                        >
                                                            As {review.role_reviewed === "seller" ? "Seller" : "Buyer"}
                                                        </span>
                                                    </div>
                                                    <span className={`text-[10px] ${MUTED} block`}>
                                                        {new Date(review.created_at).toLocaleDateString("en-US", {
                                                            month: "short",
                                                            day: "numeric",
                                                            year: "numeric",
                                                        })}
                                                    </span>
                                                </div>
                                            </Link>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <div className={`relative w-9 h-9 rounded-full overflow-hidden ${SURFACE} border ${LINE} shrink-0`}>
                                                    <Image
                                                        src={reviewer.avatar_url || "/placeholder-avatar.png"}
                                                        alt={name}
                                                        fill
                                                        sizes="36px"
                                                        className="object-cover"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs font-bold ${TEXT}`}>{name}</span>
                                                        <span
                                                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider ${review.role_reviewed === "seller"
                                                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                                                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                                                }`}
                                                        >
                                                            As {review.role_reviewed === "seller" ? "Seller" : "Buyer"}
                                                        </span>
                                                    </div>
                                                    <span className={`text-[10px] ${MUTED} block`}>
                                                        {new Date(review.created_at).toLocaleDateString("en-US", {
                                                            month: "short",
                                                            day: "numeric",
                                                            year: "numeric",
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {badge && (
                                            <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${badge.className}`}>
                                                {badge.label}
                                            </span>
                                        )}
                                        <div className="flex text-amber-400">
                                            {[...Array(5)].map((_, idx) => (
                                                <Star
                                                    key={idx}
                                                    size={14}
                                                    className={
                                                        idx < numericRating
                                                            ? "fill-amber-400 text-amber-400"
                                                            : "text-stone-400 dark:text-neutral-600"
                                                    }
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <p className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed mt-1">
                                    {review.comment || "No comment provided."}
                                </p>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}