"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";
import { Heart, Loader2, ArrowLeft } from "lucide-react";

export default function FavoritesPage() {
    const [favorites, setFavorites] = useState([]);
    const [loading, setLoading] = useState(true);

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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {favorites.map((fav) => {
                            const product = fav.products;
                            if (!product) return null;

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
                )}
            </div>
        </div>
    );
}