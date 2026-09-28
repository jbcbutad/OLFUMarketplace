"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShoppingCart, Star, Loader2, ArrowLeft, User, Pencil, MessageSquare, Search, ArrowUpDown } from "lucide-react";
import ReviewModal from "@/components/ReviewModal";

export default function PurchaseHistoryPage() {
    const [purchases, setPurchases] = useState([]);
    const [reviewsMap, setReviewsMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [selectedTxForReview, setSelectedTxForReview] = useState(null);

    // Search, Filter & Sort States
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [sortBy, setSortBy] = useState("newest");

    const router = useRouter();

    const fetchPurchaseHistory = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push("/login");
            return;
        }
        setCurrentUserId(user.id);

        try {
            const { data: transactions, error: txError } = await supabase
                .from("transactions")
                .select(`
                  id,
                  product_id,
                  seller_id,
                  buyer_id,
                  transaction_type,
                  status,
                  created_at,
                  products ( id, title, price, image_urls ),
                  profiles:seller_id ( id, full_name, "First_Name", "Last_Name", email, avatar_url )
                `)
                .eq("buyer_id", user.id)
                .eq("status", "completed")
                .order("created_at", { ascending: false });

            if (txError) throw txError;
            setPurchases(transactions || []);

            const { data: myReviews } = await supabase
                .from("reviews")
                .select("id, transaction_id, rating, comment")
                .eq("reviewer_id", user.id);

            if (myReviews) {
                const map = {};
                myReviews.forEach((r) => {
                    map[r.transaction_id] = r;
                });
                setReviewsMap(map);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchPurchaseHistory();
    }, [fetchPurchaseHistory]);

    // Process Search, Filter, and Sort Client-side
    const processedPurchases = useMemo(() => {
        return purchases
            .filter((tx) => {
                const title = tx.products?.title?.toLowerCase() || "";
                const seller = tx.profiles;
                const sellerName = (seller?.full_name || `${seller?.First_Name || ""} ${seller?.Last_Name || ""}`.trim() || seller?.email || "").toLowerCase();
                const query = searchQuery.toLowerCase();

                const matchesSearch = title.includes(query) || sellerName.includes(query);
                const matchesType = filterType === "all" || tx.transaction_type === filterType;

                return matchesSearch && matchesType;
            })
            .sort((a, b) => {
                if (sortBy === "oldest") return new Date(a.created_at) - new Date(b.created_at);
                if (sortBy === "price_high") return (b.products?.price || 0) - (a.products?.price || 0);
                if (sortBy === "price_low") return (a.products?.price || 0) - (b.products?.price || 0);
                return new Date(b.created_at) - new Date(a.created_at);
            });
    }, [purchases, searchQuery, filterType, sortBy]);

    if (loading) return (
        <div className="min-h-screen text-foreground flex items-center justify-center">
            <Loader2 className="animate-spin text-foreground" size={32} />
        </div>
    );

    return (
        <div className="text-foreground w-full min-h-screen p-6 md:p-10 transition-colors">
            <div className="max-w-5xl mx-auto">
                <div className="mb-6">
                    <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium mb-4 transition-colors">
                        <ArrowLeft size={16} /> Back to Marketplace
                    </Link>
                    <h1 className="text-3xl font-black uppercase italic tracking-tight flex items-center gap-3">
                        <ShoppingCart className="text-yellow-500" size={32} /> Purchase History
                    </h1>
                </div>

                {/* THEMED FILTER & CONTROL BAR */}
                <div className="bg-card border border-border rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-xs">
                    {/* Search Input */}
                    <div className="relative w-full md:w-72">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search title or seller..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-muted/60 border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-yellow-500 transition-colors"
                        />
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                        {/* Transaction Type Filter */}
                        <div className="flex bg-muted p-1 rounded-xl border border-border text-xs font-bold">
                            {["all", "sale", "rental"].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setFilterType(type)}
                                    className={`px-3 py-1.5 rounded-lg capitalize transition-all ${filterType === type
                                            ? "bg-yellow-500 text-black shadow-xs font-black"
                                            : "text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>

                        {/* Sort Dropdown */}
                        <div className="flex items-center gap-1.5 bg-muted border border-border px-3 py-1.5 rounded-xl text-xs font-bold text-foreground">
                            <ArrowUpDown size={14} className="text-yellow-500 shrink-0" />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="bg-transparent text-foreground outline-none cursor-pointer"
                            >
                                <option value="newest" className="bg-card text-foreground">Newest First</option>
                                <option value="oldest" className="bg-card text-foreground">Oldest First</option>
                                <option value="price_high" className="bg-card text-foreground">Price: High to Low</option>
                                <option value="price_low" className="bg-card text-foreground">Price: Low to High</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* PURCHASE LIST */}
                <div className="space-y-4">
                    {processedPurchases.length > 0 ? (
                        processedPurchases.map((tx) => {
                            const seller = tx.profiles;
                            const product = tx.products;
                            const sellerName = seller?.full_name || `${seller?.First_Name || ""} ${seller?.Last_Name || ""}`.trim() || seller?.email || "Seller";
                            const existingReview = reviewsMap[tx.id];

                            return (
                                <div key={tx.id} className="bg-card border border-border rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
                                    <div className="flex items-center gap-4">
                                        <img src={product?.image_urls?.[0] || "/placeholder.png"} alt={product?.title} className="w-16 h-16 rounded-xl object-cover border border-border bg-muted shrink-0" />
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                                                    {tx.status}
                                                </span>
                                                {tx.transaction_type && (
                                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded border bg-muted text-muted-foreground border-border">
                                                        {tx.transaction_type}
                                                    </span>
                                                )}
                                                {product?.price && (
                                                    <span className="text-xs font-bold text-yellow-500">
                                                        ₱{Number(product.price).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="font-bold text-base text-foreground">{product?.title || "Item"}</h3>
                                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                <User size={12} className="text-yellow-500" /> Seller: <strong className="text-foreground">{sellerName}</strong>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                        {/* View Chat Button */}
                                        <Link
                                            href={`/chat/${tx.seller_id}?sellerId=${tx.seller_id}`}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-accent text-foreground border border-border rounded-xl text-xs font-bold transition-all"
                                        >
                                            <MessageSquare size={13} className="text-yellow-500" /> View Chat
                                        </Link>

                                        {/* Review Button */}
                                        {existingReview ? (
                                            <button
                                                onClick={() => setSelectedTxForReview({ ...tx, existingReview })}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-accent text-foreground border border-border rounded-xl text-xs font-bold transition-all"
                                            >
                                                <Pencil size={13} className="text-yellow-500" /> Edit Review
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setSelectedTxForReview(tx)}
                                                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs"
                                            >
                                                <Star size={14} className="fill-black" /> Review Seller
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-20 bg-card/50 rounded-3xl border border-dashed border-border text-muted-foreground font-bold uppercase text-sm">
                            {purchases.length === 0 ? "No Purchase History Found" : "No Matching Purchases"}
                        </div>
                    )}
                </div>
            </div>

            {selectedTxForReview && (
                <ReviewModal
                    transactionId={selectedTxForReview.id}
                    productId={selectedTxForReview.product_id}
                    reviewerId={currentUserId}
                    revieweeId={selectedTxForReview.seller_id}
                    revieweeName={selectedTxForReview.profiles?.full_name || "Seller"}
                    roleReviewed="seller"
                    initialRating={selectedTxForReview.existingReview?.rating || 5}
                    initialComment={selectedTxForReview.existingReview?.comment || ""}
                    existingReviewId={selectedTxForReview.existingReview?.id || null}
                    onClose={() => setSelectedTxForReview(null)}
                    onSuccess={fetchPurchaseHistory}
                />
            )}
        </div>
    );
}