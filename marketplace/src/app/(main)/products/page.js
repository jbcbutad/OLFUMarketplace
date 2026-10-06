import { supabase } from "@/lib/supabase/client";
import ProductCard from "@/components/ProductCard";
import { isMerch } from "@/lib/merch";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const nowIso = new Date().toISOString();
  const { data: products, error } = await supabase
    .from("products")
    .select(`
      id,
      title,
      price,
      image_urls,
      tags,
      users ( First_Name, Last_Name ),
      categories ( name )
    `)
    .eq("is_available", true)
    .eq("status", "active")
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("created_at", { ascending: false });

  return (
    <div className="text-foreground min-h-screen p-6 md:p-10 transition-colors">
      <div className="max-w-screen-2xl mx-auto">
        <h1 className="text-3xl font-black mb-8 uppercase italic">All Products</h1>

        {error ? (
          <p className="text-red-500">Failed to load products.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {products?.filter((p) => !isMerch(p)).map((product) => {
              const sellerName = `${product.users?.First_Name || ""} ${product.users?.Last_Name || ""}`.trim() || "Unknown Seller";
              return (
                <Link key={product.id} href={`/products/${product.id}`} className="block group">
                  <ProductCard
                    title={product.title}
                    price={product.price}
                    seller={sellerName}
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