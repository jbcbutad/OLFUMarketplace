import { supabase } from "@/lib/supabase/client";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

const LIMIT = 30; // kept at your original 30

// "just now", "5 min ago", "3 hr ago", "2 days ago", then a short date
function timeAgo(iso?: string | null) {
    if (!iso) return "";
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";

    const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (seconds < 60) return "Just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

    return new Date(iso).toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

// Full date/time for the hover tooltip
function fullDate(iso?: string | null) {
    if (!iso) return "";
    return new Date(iso).toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
    });
}

export default async function RecentListingsPage() {
    const nowIso = new Date().toISOString();

    // Newest 24 active listings. Merchandise is excluded in the query itself
    // (categories!inner + neq), so the limit always returns a full 24 and merch
    // only appears on the /merchandise page.
    const { data: products, error } = await supabase
        .from("products")
        .select(`
      id,
      title,
      price,
      image_urls,
      created_at,
      tags,
      is_available,
      profiles ( full_name ),
      categories!inner ( name )
    `)
        .eq("is_available", true)
        .eq("status", "active")
        .neq("categories.name", "Merchandise")
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order("created_at", { ascending: false })
        .limit(LIMIT);

    if (error) {
        console.error("Error loading recent items:", error);
    }

    return (
        <div className="text-foreground w-full min-h-screen flex flex-col justify-between select-none transition-colors">
            <div className="max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-10 flex-grow">
                <div className="flex flex-col mb-8">
                    <h2 className="text-3xl font-extrabold text-foreground">Recent Listings</h2>
                    <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
                        The {LIMIT} newest items added to the marketplace
                    </p>
                </div>

                {error ? (
                    <div className="text-center py-20 text-red-500 font-semibold">
                        Error loading recent items: {error.message}
                    </div>
                ) : !products || products.length === 0 ? (
                    <div className="text-center py-24 bg-neutral-50 dark:bg-neutral-900/40 rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-800 animate-in fade-in duration-500">
                        <p className="text-neutral-500 dark:text-neutral-400 text-lg font-medium">
                            No recent listings found.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {products.map((product: any, index: number) => {
                            const sellerName = product.profiles?.full_name || "Unknown Seller";
                            const coverImage = product.image_urls?.[0] || "/placeholder.png";

                            return (
                                <Link
                                    href={`/products/${product.id}`}
                                    key={product.id}
                                    className="block group transition-all duration-300 hover:-translate-y-1 active:scale-95"
                                >
                                    <ProductCard
                                        title={product.title}
                                        price={product.price}
                                        seller={sellerName}
                                        image={coverImage}
                                        category={product.categories?.name}
                                        tags={product.tags}
                                        priority={index < 4}
                                    />
                                    <p
                                        title={fullDate(product.created_at)}
                                        className="mt-2 flex items-center gap-1.5 px-1 text-xs font-medium text-neutral-500 dark:text-neutral-400"
                                    >
                                        <Clock size={12} className="shrink-0" />
                                        Listed {timeAgo(product.created_at)}
                                    </p>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}