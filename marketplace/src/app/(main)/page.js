import { supabase } from "@/lib/supabase/client";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";
import { X, ArrowLeft, Search, ShieldCheck, Package } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }) {
  const resolvedParams = await searchParams;
  const selectedCategory = resolvedParams?.category || null;

  // 1. Fetch ALL categories
  const { data: categoriesData } = await supabase
    .from("categories")
    .select("id, name, icon");

  // 👉 Filter out "Merchandise" from the category browse bar
  const filteredCategories = categoriesData?.filter(
    (cat) => cat.name.toLowerCase() !== "merchandise"
  );

  // 2. The Filter Query
  let query = supabase
    .from("products")
    .select(`
    id,
    title,
    price,
    image_urls,
    created_at,
    tags,
    status,
    profiles ( full_name ),
    categories ( name )
  `)
    .eq("is_available", true)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (selectedCategory) {
    query = supabase
      .from("products")
      .select(`
      id,
      title,
      price,
      image_urls,
      created_at,
      tags,
      status,
      profiles ( full_name ),
      categories!inner ( name )
    `)
      .eq("is_available", true)
      .eq("status", "active")
      .eq("categories.name", selectedCategory)
      .order("created_at", { ascending: false });
  }

  const { data: rawProducts, error } = await query;

  if (error) {
    console.error("Error fetching products:", error);
  }

  // 👉 If browsing the general marketplace feed (no category selected), 
  // exclude merchandise items so they only show up on the /merchandise page.
  const products = selectedCategory
    ? rawProducts
    : rawProducts?.filter((p) => p.categories?.name?.toLowerCase() !== "merchandise");

  return (
    <div className="text-foreground w-full min-h-screen flex flex-col justify-between select-none transition-colors">

      {/* Main Content Area */}
      <div className="max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-10 flex-grow">

        {/* 👉 MERCHANDISE PROMOTIONAL BANNER (PLACED AT THE VERY TOP) */}
        {!selectedCategory && (
          <div className="mb-10">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-neutral-900 to-neutral-950 border border-emerald-500/40 p-8 shadow-[0_0_30px_rgba(16,185,129,0.15)] flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-2 text-center md:text-left relative z-10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck size={14} /> Official University Merch
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Support Official Campus Organizations
                </h2>
                <p className="text-sm text-neutral-400 max-w-xl">
                  Browse authentic merchandise backed by our verified institutional partners. Secure payments, fast coordination, and guaranteed quality.
                </p>
              </div>

              <div className="relative z-10 shrink-0">
                <Link
                  href="/merchandise"
                  className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center gap-2 cursor-pointer hover:scale-105"
                >
                  <Package size={16} /> Explore Merch Store
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 3. DYNAMIC UI TOGGLE */}
        <div className="mb-12">
          {!selectedCategory ? (
            /* --- STATE A: BROWSE MODE --- */
            <>
              <div className="flex flex-col mb-8">
                <h2 className="text-3xl font-extrabold text-foreground">Marketplace</h2>
                <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
                  Select a category to start shopping
                </p>
              </div>

              <div className="flex overflow-x-auto gap-4 pb-4 snap-x scrollbar-none">
                {filteredCategories?.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/?category=${encodeURIComponent(cat.name)}`}
                    className="shrink-0 snap-start flex flex-row items-center gap-3 px-6 py-4 rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 shadow-sm hover:border-foreground transition-all group active:scale-95"
                  >
                    <span className="text-3xl group-hover:scale-110 transition-transform duration-200">
                      {cat.icon}
                    </span>
                    <span className="text-sm font-semibold text-foreground tracking-wide whitespace-nowrap">
                      {cat.name}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            /* --- STATE B: SEARCH MODE --- */
            <div className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">

              <div className="mb-4 md:mb-0">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-neutral-500 dark:text-neutral-400 hover:text-foreground mb-3 transition-colors text-sm font-medium"
                >
                  <ArrowLeft size={16} /> Back to all categories
                </Link>
                <h2 className="text-3xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
                  <Search size={28} className="text-neutral-400" />
                  {selectedCategory}
                </h2>
                <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1 font-medium ml-10">
                  {products?.length || 0} {products?.length === 1 ? 'listing' : 'listings'} found
                </p>
              </div>

              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-foreground text-background hover:opacity-90 rounded-xl transition-all font-bold active:scale-95"
              >
                <X size={18} /> Clear Filter
              </Link>

            </div>
          )}
        </div>

        {/* 4. PRODUCT LISTING GRID */}
        {error ? (
          <div className="text-center py-20 text-red-500 font-semibold">
            Error loading marketplace data.
          </div>
        ) : products?.length === 0 ? (
          <div className="text-center py-24 bg-neutral-50 dark:bg-neutral-900/40 rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-800 animate-in fade-in duration-500">
            <p className="text-neutral-500 dark:text-neutral-400 text-lg font-medium">
              No products found in "{selectedCategory}".
            </p>
            <Link
              href="/"
              className="text-blue-600 dark:text-blue-400 font-bold mt-4 inline-block hover:underline"
            >
              Clear filter and see all items
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {products?.map((product, index) => {
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

      <footer className="w-full h-2 bg-background shrink-0" />
    </div>
  );
}