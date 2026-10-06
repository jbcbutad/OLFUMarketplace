import { supabase } from "@/lib/supabase/client";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";
import { isMerch } from "@/lib/merch";
export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }) {
  const resolvedParams = await searchParams;
  const searchQuery = resolvedParams?.q || "";
  const nowIso = new Date().toISOString();

  let products = [];
  let error = null;

  if (searchQuery) {
    const stopWords = new Set(["a", "an", "the", "and", "or", "for", "with", "in", "of", "on", "at", "to", "is"]);
    const sanitizedQuery = searchQuery.replace(/['"{}\[\]]/g, "").trim();
    const words = sanitizedQuery
      .split(/\s+/)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length > 1 && !stopWords.has(w));

    const categoryConditions = words.map((w) => `name.ilike.%${w}%`).join(",");
    const { data: categoryMatches } = await supabase
      .from("categories")
      .select("id")
      .or(categoryConditions || `name.ilike.%${sanitizedQuery}%`);

    const rules = [];

    // Full query matches
    rules.push(`title.ilike.%${sanitizedQuery}%`);
    rules.push(`description.ilike.%${sanitizedQuery}%`);

    // Word matches for title, description, and tags
    words.forEach((word) => {
      rules.push(`title.ilike.%${word}%`);
      rules.push(`description.ilike.%${word}%`);
      rules.push(`tags.cs.{${word}}`);
    });

    if (categoryMatches && categoryMatches.length > 0) {
      const categoryIds = categoryMatches.map((c) => c.id).join(",");
      rules.push(`category_id.in.(${categoryIds})`);
    }

    const searchRule = rules.join(",");

    const res = await supabase
      .from("products")
      .select(`
        id,
        title,
        description,
        price,
        image_urls,
        created_at,
        tags,
        category_id,
        users:seller_id (
          First_Name,
          Last_Name
        ),
        profiles ( full_name, org_name, is_verified_org ),
        categories (
          name
        )
      `)
      .or(searchRule)
      .eq("is_available", true)
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

    if (res.data) {
      const lowerQuery = sanitizedQuery.toLowerCase();

      // Score items to bring exact matches to top, followed by related items
      products = res.data
        .filter((product) => !isMerch(product) || product.profiles?.is_verified_org)
        .map((product) => {
          let score = 0;
          const title = (product.title || "").toLowerCase();
          const desc = (product.description || "").toLowerCase();
          const productTags = (product.tags || []).map((t) => t.toLowerCase());

          // Exact phrase match gets highest priority
          if (title.includes(lowerQuery)) score += 10;
          if (productTags.includes(lowerQuery)) score += 8;

          // Individual word matches get partial scoring
          words.forEach((word) => {
            if (title.includes(word)) score += 4;
            if (productTags.includes(word)) score += 3;
            if (desc.includes(word)) score += 1;
          });

          return { ...product, relevanceScore: score };
        });

      // Sort by relevance score first, then newest first
      products.sort((a, b) => b.relevanceScore - a.relevanceScore || new Date(b.created_at) - new Date(a.created_at));
    }

    error = res.error;
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-96 text-foreground transition-colors">
        <p className="text-red-500 font-semibold">Search failed: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="text-foreground w-full min-h-screen p-6 md:p-10 transition-colors">
      <div className="max-w-screen mx-auto">
        <div className="mb-8 flex flex-col">
          <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
            Search Results for "{searchQuery}"
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1 font-medium">
            Found {products?.length || 0} {products?.length === 1 ? 'item' : 'items'} matching your search.
          </p>
        </div>

        {!products || products.length === 0 ? (
          <div className="text-center py-24 bg-background rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-700 animate-in fade-in duration-500">
            <p className="text-neutral-500 dark:text-neutral-400 text-lg mb-4">No listings found. Try a different keyword!</p>
            <Link href="/marketplace" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-foreground text-background hover:opacity-90 rounded-xl transition-all font-bold active:scale-95 text-sm uppercase tracking-wider">
              Back to Home
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {products.map((product, index) => {
              const firstName = product.users?.First_Name || "";
              const lastName = product.users?.Last_Name || "";
              const sellerName = (firstName || lastName)
                ? `${firstName} ${lastName}`.trim()
                : "Unknown Seller";

              const coverImage = (product.image_urls && product.image_urls.length > 0)
                ? product.image_urls[0]
                : "/placeholder.png";

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
                    orgName={product.profiles?.org_name}
                    isVerifiedOrg={product.profiles?.is_verified_org}
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