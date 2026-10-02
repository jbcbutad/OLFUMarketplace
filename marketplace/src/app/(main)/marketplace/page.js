import { supabase } from "@/lib/supabase/client";
import ProductCard from "@/components/ProductCard";
import OlfuMerchBanner from "@/components/OlfuMerchBanner";
import Link from "next/link";
import { X, Filter, Tag, ShieldCheck, Package, Sparkles, ArrowRight } from "lucide-react";


export const dynamic = "force-dynamic";

// ---------- Generated merch illustrations (inline SVG) ----------
function TeeArt() {
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_12px_20px_rgba(0,0,0,0.5)]">
      <defs>
        <linearGradient id="teeG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      <path d="M60 30 L85 20 Q100 40 115 20 L140 30 L182 66 L158 92 L140 78 L140 178 L60 178 L60 78 L42 92 L18 66 Z" fill="url(#teeG)" />
      <path d="M85 20 Q100 40 115 20 L112 16 Q100 30 88 16 Z" fill="#064e3b" />
      <path d="M60 78 L60 178 L74 178 L74 70 Z" fill="#000" opacity="0.12" />
      <circle cx="100" cy="108" r="22" fill="none" stroke="#fef08a" strokeWidth="3" />
      <text x="100" y="114" textAnchor="middle" fontSize="18" fontWeight="900" fill="#fef08a" fontFamily="sans-serif">U</text>
      <rect x="76" y="142" width="48" height="4" rx="2" fill="#fef08a" opacity="0.9" />
      <rect x="86" y="152" width="28" height="3" rx="1.5" fill="#fef08a" opacity="0.6" />
    </svg>
  );
}

function ToteArt() {
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_12px_20px_rgba(0,0,0,0.5)]">
      <defs>
        <linearGradient id="toteG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <path d="M72 78 C72 18 128 18 128 78" fill="none" stroke="#b45309" strokeWidth="7" strokeLinecap="round" />
      <path d="M48 74 H152 L162 184 H38 Z" fill="url(#toteG)" />
      <path d="M48 74 H152 L153 86 H47 Z" fill="#000" opacity="0.1" />
      <rect x="68" y="110" width="64" height="44" rx="6" fill="#111827" />
      <text x="100" y="138" textAnchor="middle" fontSize="15" fontWeight="900" fill="#fbbf24" fontFamily="sans-serif">CAMPUS</text>
      <text x="100" y="149" textAnchor="middle" fontSize="7" fontWeight="700" fill="#9ca3af" fontFamily="sans-serif" letterSpacing="2">OFFICIAL</text>
    </svg>
  );
}

function HoodieArt() {
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_12px_20px_rgba(0,0,0,0.5)]">
      <defs>
        <linearGradient id="hoodG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#5b21b6" />
        </linearGradient>
      </defs>
      <path d="M62 40 Q100 22 138 40 L184 88 L162 156 L140 142 L140 184 L60 184 L60 142 L38 156 L16 88 Z" fill="url(#hoodG)" />
      <path d="M70 40 Q100 4 130 40 Q100 66 70 40 Z" fill="#4c1d95" />
      <path d="M82 44 Q100 58 118 44" fill="none" stroke="#2e1065" strokeWidth="3" />
      <line x1="92" y1="58" x2="90" y2="84" stroke="#ede9fe" strokeWidth="3" strokeLinecap="round" />
      <line x1="108" y1="58" x2="110" y2="84" stroke="#ede9fe" strokeWidth="3" strokeLinecap="round" />
      <path d="M72 138 H128 L122 168 H78 Z" fill="#000" opacity="0.18" />
      <text x="100" y="118" textAnchor="middle" fontSize="13" fontWeight="900" fill="#ede9fe" fontFamily="sans-serif" letterSpacing="3">ORG</text>
    </svg>
  );
}

const MERCH_BOXES = [
  {
    badge: "New Drop",
    title: "Org Tees",
    sub: "Soft, bold, made for campus.",
    Art: TeeArt,
    bg: "from-emerald-900 via-emerald-950 to-neutral-950",
    glow: "bg-emerald-400/25",
    tilt: "-rotate-6 group-hover:-rotate-3",
  },
  {
    badge: "Best Seller",
    title: "Totes & Bags",
    sub: "Carry your school pride.",
    Art: ToteArt,
    bg: "from-amber-800 via-amber-950 to-neutral-950",
    glow: "bg-amber-400/25",
    tilt: "rotate-3 group-hover:rotate-6",
  },
  {
    badge: "Cozy Season",
    title: "Hoodies",
    sub: "Official org hoodies are here.",
    Art: HoodieArt,
    bg: "from-violet-900 via-violet-950 to-neutral-950",
    glow: "bg-violet-400/25",
    tilt: "-rotate-3 group-hover:rotate-0",
  },
];



export default async function Home({ searchParams }) {
  const resolvedParams = await searchParams;
  const nowIso = new Date().toISOString();
  const selectedCategory = resolvedParams?.category || null;
  const activeTag = resolvedParams?.tag || null;

  // 1. Fetch ALL categories
  const { data: categoriesData } = await supabase
    .from("categories")
    .select("id, name, icon")
    .order("name", { ascending: true });

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
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
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
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .eq("categories.name", selectedCategory)
      .order("created_at", { ascending: false });
  }

  // 👉 Tag filter (works with either query above)
  if (activeTag) {
    query = query.contains("tags", [activeTag]);
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

  // Extract all unique tags across items for filter pills
  const HIDDEN_TAGS = ["Pending", "Expired"];
  const allTags = Array.from(
    new Set(products?.flatMap((p) => p.tags || []) || [])
  ).filter((t) => !HIDDEN_TAGS.includes(t));

  return (
    <div className="text-foreground w-full min-h-screen flex flex-col justify-between select-none transition-colors">

      {/* Main Content Area */}
      <div className="max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-10 flex-grow">

        {/* 👉 MERCHANDISE PROMOTIONAL BANNER (PLACED AT THE VERY TOP) */}
        {!selectedCategory && (
          <div className="mb-10">
            <OlfuMerchBanner className="h-56 sm:h-[380px] rounded-3xl border border-white/10 mb-10"
              merchUrl="/merchandise"
            />

            {/* 👉 MERCH BANNERS (3 BOXES WITH GENERATED ART) */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {MERCH_BOXES.map(({ badge, title, sub, Art, bg, glow, tilt }) => (
                <Link
                  key={title}
                  href="/merchandise"
                  className={`group relative block h-56 sm:h-64 overflow-hidden rounded-3xl border border-white/10 hover:border-white/30 bg-gradient-to-br ${bg} transition-colors`}
                >
                  {/* dotted texture */}
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      backgroundImage: "radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)",
                      backgroundSize: "18px 18px",
                    }}
                  />
                  <div className={`absolute -right-10 -bottom-10 w-64 h-64 rounded-full blur-3xl ${glow}`} />

                  {/* illustration */}
                  <div className={`absolute right-2 bottom-2 w-40 h-40 sm:w-48 sm:h-48 transition-transform duration-500 ${tilt}`}>
                    <Art />
                  </div>

                  {/* copy */}
                  <div className="relative z-10 h-full p-6 flex flex-col justify-between max-w-[60%]">
                    <div className="inline-flex w-fit items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/10 text-white border border-white/20 backdrop-blur">
                      <Sparkles size={12} /> {badge}
                    </div>
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">{title}</h3>
                      <p className="text-xs sm:text-sm text-white/70 mt-1">{sub}</p>
                      <span className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl font-black text-[11px] uppercase tracking-wider group-hover:gap-3 transition-all">
                        Shop now <ArrowRight size={14} />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col mb-8">
          <h2 className="text-3xl font-extrabold text-foreground">Marketplace</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
            Select a category to start shopping
          </p>
        </div>

        {/* Category Pills */}
        <div className="mb-8">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Filter size={14} /> Categories
          </h3>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/marketplace"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${!selectedCategory
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground border border-border hover:text-foreground"
                }`}
            >
              ALL CATEGORIES
            </Link>
            {filteredCategories?.map((cat) => (
              <Link
                key={cat.id}
                href={`/marketplace?category=${encodeURIComponent(cat.name)}${activeTag ? `&tag=${encodeURIComponent(activeTag)}` : ""
                  }`}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${selectedCategory === cat.name
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground border border-border hover:text-foreground"
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
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Tag size={14} /> Popular Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <Link
                  key={tag}
                  href={`/marketplace?${selectedCategory ? `category=${encodeURIComponent(selectedCategory)}&` : ""
                    }tag=${encodeURIComponent(tag)}`}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTag === tag
                    ? "bg-yellow-500 text-black font-bold"
                    : "bg-muted text-muted-foreground border border-border hover:text-foreground"
                    }`}
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Active Filters Bar */}
        {(selectedCategory || activeTag) && (
          <div className="mb-6 flex items-center gap-3">
            <span className="text-xs text-neutral-400">Active filters:</span>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold hover:bg-red-500/20"
            >
              <X size={12} /> Clear Filters
            </Link>
          </div>
        )}

        {/* 4. PRODUCT LISTING GRID */}
        {error ? (
          <div className="text-center py-20 text-red-500 font-semibold">
            Error loading marketplace data.
          </div>
        ) : products?.length === 0 ? (
          <div className="text-center py-24 bg-neutral-50 dark:bg-neutral-900/40 rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-800 animate-in fade-in duration-500">
            <p className="text-neutral-500 dark:text-neutral-400 text-lg font-medium">
              {selectedCategory
                ? `No products found in "${selectedCategory}".`
                : "No products match your active filters."}
            </p>
            <Link
              href="/marketplace"
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