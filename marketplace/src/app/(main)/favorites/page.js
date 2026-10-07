"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase/client";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";
import { Heart, Loader2, ArrowLeft } from "lucide-react";

export default function FavoritesPage() {
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sort, setSort] = useState("recent");

    useEffect(() => {
        async function fetchFavorites() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from("favorites")
                .select(`
          id,
          product_id,
          products (
            id,
            title,
            price,
            image_urls,
            tags,
            categories ( name ),
            profiles:seller_id ( full_name )
          )
        `)
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (error) console.error("Error fetching favorites:", error);
            setFavorites(data || []);
            setLoading(false);
        }

        fetchFavorites();
    }, []);

    const sorted = useMemo(() => {
        const list = favorites.filter((f) => f.products);
        const price = (f) => Number(f.products.price) || 0;
        if (sort === "price-asc") return [...list].sort((a, b) => price(a) - price(b));
        if (sort === "price-desc") return [...list].sort((a, b) => price(b) - price(a));
        if (sort === "title") {
            return [...list].sort((a, b) =>
                (a.products.title || "").localeCompare(b.products.title || "")
            );
        }
        return list; // "recent": the query already returns newest-saved first
    }, [favorites, sort]);

    if (loading) {
        return (
            <div className="text-foreground min-h-screen flex items-center justify-center">
                <Loader2 className="animate-spin text-foreground" size={32} />
            </div>
        );
    }

    return (
        <div className="text-foreground w-full min-h-screen p-6 md:p-10 transition-colors">
            <div className="max-w-7xl mx-auto">
                <div className="mb-8">
                    <Link
                        href="/marketplace"
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium mb-4 transition-colors"
                    >
                        <ArrowLeft size={16} /> Back to Marketplace
                    </Link>
                    <h1 className="text-3xl font-black uppercase italic tracking-tight flex items-center gap-3">
                        <Heart className="text-rose-500 fill-rose-500" size={32} /> Saved Favorites
                    </h1>
                </div>

                {favorites.length === 0 ? (
                    <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border text-muted-foreground font-bold text-sm">
                        You haven't favorited any listings yet.
                    </div>
                ) : (
                    <>
                        <div className="mb-6 flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold">
                                {sorted.length} saved item{sorted.length === 1 ? "" : "s"}
                            </span>
                            <label className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                                Sort by
                                <select
                                    value={sort}
                                    onChange={(e) => setSort(e.target.value)}
                                    aria-label="Sort favorites"
                                    className="bg-stone-100 border border-stone-800 rounded-full px-3 py-1.5 text-xs font-medium text-neutral-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/30 cursor-pointer dark:bg-neutral-800 dark:text-white dark:border-neutral-700"
                                >
                                    <option value="recent">Recently saved</option>
                                    <option value="price-asc">Price: low to high</option>
                                    <option value="price-desc">Price: high to low</option>
                                    <option value="title">Name: A to Z</option>
                                </select>
                            </label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {sorted.map((fav) => {
                                const product = fav.products;

                                return (
                                    <Link key={fav.id} href={`/products/${product.id}`} className="block group">
                                        <ProductCard
                                            title={product.title}
                                            price={product.price}
                                            seller={product.profiles?.full_name || "Seller"}
                                            image={product.image_urls?.[0] || "/placeholder.png"}
                                            category={product.categories?.name}
                                            tags={product.tags}
                                        />
                                    </Link>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}