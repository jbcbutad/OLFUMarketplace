import { supabase } from "@/lib/supabase/client";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RecentListingsPage() {
  const nowIso = new Date().toISOString();
  // Fetch recent products joining against public.profiles and categories
  const { data: rawProducts, error } = await supabase
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
      categories ( name )
    `)
    .eq("is_available", true)
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(50); // Fetch a slightly higher limit to account for filtered out merch items

  if (error) {
    console.error("Error loading recent items:", error);
  }

  // 👉 Exclude merchandise products so they only appear on the /merchandise page
  const products = rawProducts?.filter(
    (p) => p.categories?.name?.toLowerCase() !== "merchandise"
  ).slice(0, 30); // Keep your original limit of 30 after filtering

  return (
    <div className="text-foreground w-full min-h-screen flex flex-col justify-between select-none transition-colors">
      <div className="max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-10 flex-grow">
        <div className="flex flex-col mb-8">
          <h2 className="text-3xl font-extrabold text-foreground">Recent Listings</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
            Browse the latest items added to the marketplace
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
            {products.map((product, index) => {
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
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}