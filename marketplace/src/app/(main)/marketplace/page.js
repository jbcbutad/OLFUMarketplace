import { supabase } from "@/lib/supabase/client";
import ProductCard from "@/components/ProductCard";
import OlfuMerchBanner from "@/components/OlfuMerchBanner";
import Link from "next/link";
import { isMerch } from "@/lib/merch";
import SortSelect from "@/components/SortSelect";
import { SORT_OPTIONS, parseSort, sortProducts } from "@/lib/sort";
import { X, Tag, Sparkles, ArrowRight, ChevronDown } from "lucide-react";

export const dynamic = "force-dynamic";

const BASE_PATH = "/marketplace";
const VISIBLE_TAGS = 12; // tags shown before "Show more"
const HIDDEN_TAG_KEYS = new Set(["pending", "expired"]);

// "Campus Essentials", "campus-essentials", "#campusessentials" -> "campusessentials"
const tagKey = (t) =>
  String(t).trim().replace(/^#+/, "").toLowerCase().replace(/[\s_,-]+/g, "");

const tagLabel = (t) =>
  String(t).trim().replace(/^#+/, "").toLowerCase().replace(/\s+/g, " ");

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
  const params = await searchParams;
  const nowIso = new Date().toISOString();
  const selectedCategory = params?.category || null;
  const sort = parseSort(params?.sort);

  // ?tags=sale,books  (the old ?tag=sale still works)
  const activeTags = [
    ...new Set(
      String(params?.tags ?? params?.tag ?? "")
        .split(",")
        .map(tagKey)
        .filter(Boolean)
    ),
  ];

  // Build links that keep the other filters intact
  const buildHref = (overrides = {}) => {
    const next = {
      category: selectedCategory,
      tags: activeTags.join(",") || null,
      sort: sort === "newest" ? null : sort,
      ...overrides,
    };
    const qs = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => v && qs.set(k, v));
    const s = qs.toString();
    return s ? `${BASE_PATH}?${s}` : BASE_PATH;
  };

  // Clicking a tag adds it; clicking a selected tag removes it
  const toggleTagHref = (key) =>
    buildHref({
      tags:
        (activeTags.includes(key)
          ? activeTags.filter((k) => k !== key)
          : [...activeTags, key]
        ).join(",") || null,
    });

  const sortHrefs = Object.fromEntries(
    SORT_OPTIONS.map((o) => [
      o.value,
      buildHref({ sort: o.value === "newest" ? null : o.value }),
    ])
  );
  // 1. Categories (Merchandise stays out of the browse bar)
  const { data: categoriesData } = await supabase
    .from("categories")
    .select("id, name, icon")
    .order("name", { ascending: true });

  const categories = categoriesData || [];

  // Base query (category-filtered)
  const buildQuery = (fields) => {
    let q = supabase
      .from("products")
      .select(
        `${fields}, categories${selectedCategory ? "!inner" : ""} ( name )`
      )
      .eq("is_available", true)
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
    if (selectedCategory) q = q.eq("categories.name", selectedCategory);
    return q;
  };

  // General feed hides merchandise (it lives on /merchandise)
  const dropMerch = (rows) => (rows || []).filter((p) => !isMerch(p));

  // 2. One query for the products
  const { data: rawProducts, error } = await buildQuery(`
    id,
    title,
    price,
    image_urls,
    created_at,
    tags,
    status,
    profiles ( full_name )
  `).order("created_at", { ascending: false });

  if (error) console.error("Error fetching products:", error);

  // 3. Keep only items that have EVERY selected tag
  //    (compared with tagKey so "Books" / "books" / "#books" all match)
  const hasAllTags = (p) => {
    const keys = new Set((p.tags || []).map(tagKey));
    return activeTags.every((k) => keys.has(k));
  };
  const products = sortProducts(dropMerch(rawProducts).filter(hasAllTags), sort);

  // 4. Tag list is built from the REMAINING items only
  const tagMap = new Map(); // key -> { key, label, count }
  products.forEach((row) => {
    const seenInRow = new Set();
    (row.tags || []).forEach((raw) => {
      const key = tagKey(raw);
      if (!key || HIDDEN_TAG_KEYS.has(key) || seenInRow.has(key)) return;
      seenInRow.add(key);

      const label = tagLabel(raw);
      const existing = tagMap.get(key);
      if (!existing) {
        tagMap.set(key, { key, label, count: 1 });
      } else {
        existing.count += 1;
        if (/[\s-]/.test(label) && !/[\s-]/.test(existing.label)) {
          existing.label = label; // prefer the more readable variant
        }
      }
    });
  });

  const selectedTagObjs = activeTags.map(
    (k) => tagMap.get(k) || { key: k, label: k, count: 0 }
  );
  const relatedTags = Array.from(tagMap.values())
    .filter((t) => !activeTags.includes(t.key))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const tags = [...selectedTagObjs, ...relatedTags]; // selected first
  const topTags = tags.slice(0, VISIBLE_TAGS);
  const moreTags = tags.slice(VISIBLE_TAGS);

  const pillBase =
    "shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 border";
  const pillOn =
    "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 hover:border-emerald-800 dark:bg-emerald-700 dark:text-white dark:border-emerald-600 dark:hover:bg-emerald-800 dark:hover:border-emerald-500";
  const pillOff =
    "bg-stone-200 text-black border-stone-800 hover:bg-emerald-50 hover:border-emerald-700 dark:bg-neutral-800 dark:text-white dark:border-neutral-700 dark:hover:bg-emerald-950 dark:hover:border-emerald-700";

  const tagPill = (t) => {
    const on = activeTags.includes(t.key);
    return (
      <Link
        key={t.key}
        scroll={false}
        href={toggleTagHref(t.key)}
        aria-pressed={on}
        className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${on
          ? "bg-emerald-600 text-white font-semibold border border-emerald-700 hover:bg-emerald-700 dark:bg-emerald-700 dark:text-white dark:hover:bg-emerald-800 dark:border-emerald-600"
          : "bg-stone-200 text-neutral-700 border border-neutral-800 hover:bg-emerald-50 hover:text-black hover:border-emerald-700 dark:bg-neutral-800 dark:text-white dark:hover:bg-emerald-950 dark:border-neutral-700 dark:hover:border-emerald-700 dark:hover:text-white"
          }`}
      >
        #{t.label}
        {on ? (
          <X size={12} className="ml-1.5" />
        ) : (
          <span className="ml-1.5 opacity-50">{t.count}</span>
        )}
      </Link>
    );
  };

  return (
    <div className="text-foreground w-full min-h-screen flex flex-col justify-between select-none transition-colors">
      <div className="max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-10 flex-grow">
        {/* Merchandise banners */}
        {!selectedCategory && (
          <div className="mb-10">
            <OlfuMerchBanner
              className="h-56 sm:h-95 rounded-3xl border border-white/10 mb-10"
              merchUrl="/merchandise"
            />

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {MERCH_BOXES.map(({ badge, title, sub, Art, bg, glow, tilt }) => (
                <Link
                  key={title}
                  href="/merchandise"
                  className={`group relative block h-56 sm:h-64 overflow-hidden rounded-3xl border border-white/10 hover:border-white/30 bg-gradient-to-br ${bg} transition-colors`}
                >
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      backgroundImage:
                        "radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)",
                      backgroundSize: "18px 18px",
                    }}
                  />
                  <div
                    className={`absolute -right-10 -bottom-10 w-64 h-64 rounded-full blur-3xl ${glow}`}
                  />

                  <div
                    className={`absolute right-2 bottom-2 w-40 h-40 sm:w-48 sm:h-48 transition-transform duration-500 ${tilt}`}
                  >
                    <Art />
                  </div>

                  <div className="relative z-10 h-full p-6 flex flex-col justify-between max-w-[60%]">
                    <div className="inline-flex w-fit items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/10 text-white border border-white/20 backdrop-blur">
                      <Sparkles size={12} /> {badge}
                    </div>
                    <div>
                      <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                        {title}
                      </h3>
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

        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-extrabold text-foreground">Marketplace</h2>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
            Pick a category or tag to find what you need.
          </p>
        </div>

        {/* Categories: one scrollable row on mobile, wraps on larger screens */}
        <section className="mb-8" aria-label="Categories">
          <div className="flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
            <Link
              scroll={false}
              href={buildHref({ category: null, tags: null })}
              aria-current={!selectedCategory ? "page" : undefined}
              className={`${pillBase} ${!selectedCategory ? pillOn : pillOff}`}
            >
              All
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                scroll={false}
                href={buildHref({ category: cat.name, tags: null })}
                aria-current={selectedCategory === cat.name ? "page" : undefined}
                className={`${pillBase} ${selectedCategory === cat.name ? pillOn : pillOff}`}
              >
                <span aria-hidden="true">{cat.icon || "🏷️"}</span>
                <span>{cat.name}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Tags: selected first, then only tags that exist on the remaining items */}
        {tags.length > 0 && (
          <section className="mb-8" aria-label="Tags">
            <h3 className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-1.5 dark:text-neutral-200">
              <Tag size={14} />
              {activeTags.length > 0
                ? "Narrow down further"
                : selectedCategory
                  ? `Popular in ${selectedCategory}`
                  : "Popular tags"}
            </h3>
            <div className="flex flex-wrap gap-2">{topTags.map(tagPill)}</div>

            {activeTags.length > 0 && relatedTags.length === 0 && (
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                No other tags on these items.
              </p>
            )}

            {moreTags.length > 0 && (
              <details className="group mt-3">
                <summary className="inline-flex items-center gap-1 cursor-pointer list-none text-xs font-medium text-neutral-800 hover:text-foreground [&::-webkit-details-marker]:hidden dark:text-neutral-200 dark:hover:text-white">
                  <span className="group-open:hidden">
                    Show {moreTags.length} more
                  </span>
                  <span className="hidden group-open:inline">Show less</span>
                  <ChevronDown
                    size={14}
                    className="transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="flex flex-wrap gap-2 mt-3">
                  {moreTags.map(tagPill)}
                </div>
              </details>
            )}
          </section>
        )}

        {/* Active filters + result count */}
        <div className="mb-6 flex flex-wrap items-center gap-2 min-h-[32px]">
          <span className="text-sm font-semibold text-foreground mr-1">
            {error
              ? ""
              : `${products.length} item${products.length === 1 ? "" : "s"}`}
          </span>


          {!error && products.length > 1 && (
            <>
              <span className="h-4 w-px bg-stone-400 dark:bg-neutral-700" aria-hidden="true" />
              <SortSelect value={sort} hrefs={sortHrefs} />
            </>
          )}

          {selectedCategory && (
            <FilterChip
              label={selectedCategory}
              href={buildHref({ category: null, tags: null })}
            />
          )}
          {selectedTagObjs.map((t) => (
            <FilterChip
              key={t.key}
              label={`#${t.label}`}
              href={toggleTagHref(t.key)}
            />
          ))}
          {(selectedCategory || activeTags.length > 0) && (
            <Link
              scroll={false}
              href={BASE_PATH}
              className="ml-1 inline-flex items-center rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 transition-colors"
            >
              Clear all
            </Link>
          )}
        </div>



        {/* Product grid */}
        {error ? (
          <div className="text-center py-20 text-red-500 font-semibold">
            Couldn&apos;t load items. Please refresh the page.
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-24 bg-stone-200 rounded-3xl border border-dashed border-neutral-800 dark:bg-neutral-800 dark:border-neutral-700 dark:text-white">
            <p className="text-neutral-800 text-base font-medium dark:text-white">
              {selectedCategory
                ? `No items found in "${selectedCategory}"${activeTags.length
                  ? ` with ${selectedTagObjs.map((t) => `#${t.label}`).join(" + ")}`
                  : ""
                }.`
                : "No items match these filters."}
            </p>
            <Link
              scroll={false}
              href={BASE_PATH}
              className="text-red-500 font-semibold mt-3 inline-block hover:underline text-sm"
            >
              Clear filters
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {products.map((product, index) => (
              <Link
                href={`/products/${product.id}`}
                key={product.id}
                className="block group transition-all duration-300 hover:-translate-y-1 active:scale-95"
              >
                <ProductCard
                  title={product.title}
                  price={product.price}
                  seller={product.profiles?.full_name || "Unknown Seller"}
                  image={product.image_urls?.[0] || "/placeholder.png"}
                  category={product.categories?.name}
                  tags={product.tags}
                  priority={index < 4}
                />
              </Link>
            ))}
          </div>
        )}
      </div>

      <footer className="w-full shrink-0 border-t border-stone-400 dark:border-neutral-700 py-4 px-4 flex justify-center gap-6 text-xs text-neutral-700 dark:text-neutral-300">
        <Link href="/privacy" className="underline hover:text-foreground">
          Privacy Policy
        </Link>
        <Link href="/terms" className="underline hover:text-foreground">
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}

function FilterChip({ label, href }) {
  return (
    <Link
      scroll={false}
      href={href}
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white border border-emerald-700 text-xs font-semibold hover:bg-emerald-700 dark:bg-emerald-700 dark:border-emerald-600 dark:hover:bg-emerald-800 transition-colors"
      aria-label={`Remove filter ${label}`}
    >
      {label}
      <X size={12} />
    </Link>
  );
}