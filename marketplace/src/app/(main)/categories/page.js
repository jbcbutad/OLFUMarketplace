import { supabase } from "@/lib/supabase/client";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";
import { Search, Filter, Tag, X } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({ searchParams }) {
  const resolvedParams = await searchParams;
  const activeCategory = resolvedParams?.category || null;
  const activeTag = resolvedParams?.tag || null;
  const searchQuery = resolvedParams?.q || "";
  const nowIso = new Date().toISOString();

  // 1. Fetch categories and filter out "Merchandise" from the filter pill list
  const { data: rawCategoriesData } = await supabase
    .from("categories")
    .select("id, name, icon")
    .order("name", { ascending: true });

  const categoriesData = rawCategoriesData?.filter(
    (cat) => cat.name.toLowerCase() !== "merchandise"
  );

  // 2. Build product query joining against public.profiles
  let query = supabase
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
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("created_at", { ascending: false });

  if (activeCategory) {
    query = query.eq("categories.name", activeCategory);
  } else {
    // 👉 Exclude merchandise from the general categories grid view entirely
    query = query.neq("categories.name", "Merchandise");
  }

  if (activeTag) {
    query = query.contains("tags", [activeTag]);
  }

  if (searchQuery) {
    query = query.ilike("title", `%${searchQuery}%`);
  }

  const { data: products, error } = await query;

  if (error) {
    console.error("Categories fetch error:", error);
  }

  // Extract all unique tags across items for filter pills
  const allTags = Array.from(
    new Set(products?.flatMap((p) => p.tags || []) || [])
  );


  return (
    <div className="text-foreground w-full min-h-screen flex flex-col justify-between select-none transition-colors">
      <div className="max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-10 flex-grow">

        {/* Page Header */}
        <div className="flex flex-col mb-8">
          <h2 className="text-3xl font-extrabold text-foreground tracking-tight">
            BROWSE CATEGORIES & TAGS
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
            Filter marketplace items by category, tags, or title search
          </p>
        </div>

        {/* Search Bar */}
        <form method="GET" action="/categories" className="mb-8 max-w-xl">
          <div className="relative">
            <Search className="absolute left-4 top-3.5 text-neutral-400" size={18} />
            <input
              type="text"
              name="q"
              defaultValue={searchQuery}
              placeholder="Search product titles..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-stone-200 border border-neutral-800 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:bg-neutral-800 dark:border-neutral-700 dark:text-white dark:focus:ring-yellow-500"
            />
          </div>
        </form>

        {/* Category Pills */}
        <div className="mb-8">
          <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider mb-3 flex items-center gap-1.5 dark:text-neutral-200">
            <Filter size={14} /> Categories
          </h3>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/categories"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${!activeCategory
                ? "bg-stone-200 text-black hover:bg-emerald-50 border border-neutral-800 hover:border-emerald-700 dark:bg-emerald-900 dark:text-white dark:hover:bg-emerald-950 dark:border-neutral-700 dark:hover:border-emerald-700"
                : "bg-neutral-800 text-white hover:bg-emerald-50 border border-neutral-800 hover:border-emerald-700 dark:bg-neutral-800 dark:text-white dark:hover:bg-emerald-950 dark:border-neutral-700 dark:hover:border-emerald-700"
                }`}
            >
              ALL CATEGORIES
            </Link>
            {categoriesData?.map((cat) => (
              <Link
                key={cat.id}
                href={`/categories?category=${encodeURIComponent(cat.name)}${activeTag ? `&tag=${encodeURIComponent(activeTag)}` : ""
                  }`}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeCategory === cat.name
                  ? "bg-stone-200 text-black hover:bg-emerald-50 border border-neutral-800 hover:border-emerald-700 dark:bg-emerald-900 dark:text-white dark:hover:bg-emerald-950 dark:border-neutral-700 dark:hover:border-emerald-700"
                  : "bg-neutral-800 text-white hover:bg-emerald-50 border border-neutral-800 hover:border-emerald-700 dark:bg-neutral-800 dark:text-white dark:hover:bg-emerald-950 dark:border-neutral-700 dark:hover:border-emerald-700"
                  }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name.toUpperCase()}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="mb-10">
            <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider mb-3 flex items-center gap-1.5 dark:text-neutral-200">
              <Tag size={14} /> Popular Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <Link
                  key={tag}
                  href={`/categories?${activeCategory ? `category=${encodeURIComponent(activeCategory)}&` : ""
                    }tag=${encodeURIComponent(tag)}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTag === tag
                    ? "bg-yellow-500 text-black font-bold"
                    : "bg-neutral-900 text-neutral-400 border border-neutral-800 hover:text-foreground"
                    }`}
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Active Filters Bar */}
        {(activeCategory || activeTag || searchQuery) && (
          <div className="mb-6 flex items-center gap-3">
            <span className="text-xs text-neutral-400">Active filters:</span>
            <Link
              href="/categories"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold hover:bg-red-500/20"
            >
              <X size={12} /> Clear Filters
            </Link>
          </div>
        )}

        {/* Product Grid */}
        {error ? (
          <div className="text-center py-20 text-red-500 font-semibold">
            Error loading category items.
          </div>
        ) : !products || products.length === 0 ? (
          <div className="text-center py-24 bg-neutral-900/40 rounded-3xl border border-dashed border-neutral-800 animate-in fade-in duration-500">
            <p className="text-neutral-400 text-base font-medium">
              No items match your active filters.
            </p>
            <Link
              href="/categories"
              className="text-yellow-500 font-bold mt-3 inline-block hover:underline text-sm"
            >
              CLEAR FILTERS
            </Link>
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