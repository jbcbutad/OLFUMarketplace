import { supabase } from "@/lib/supabase/client";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";
import RentalsClawBanner from "@/components/RentalsClawBanner";
import { isMerch } from "@/lib/merch";
import SortSelect from "@/components/SortSelect";
import { SORT_OPTIONS, parseSort, sortProducts } from "@/lib/sort";
import { X, Tag, Search, ChevronDown } from "lucide-react";

export const dynamic = "force-dynamic";

const BASE_PATH = "/rentals";
const VISIBLE_TAGS = 12; // tags shown before "Show more"

// The tags ProductActions treats as rental/borrow listings. They're compared
// with tagKey below, so "Rentals", "rentals" and "#rentals" all count.
const RENTAL_TAGS = ["Rentals", "Rental", "Borrow", "For Borrow"];

// "Campus Essentials", "campus-essentials", "#campusessentials" -> "campusessentials"
const tagKey = (t) =>
    String(t).trim().replace(/^#+/, "").toLowerCase().replace(/[\s_,-]+/g, "");

const tagLabel = (t) =>
    String(t).trim().replace(/^#+/, "").toLowerCase().replace(/\s+/g, " ");

// Every listing on this page has one of these, so they're useless as filters
const RENTAL_KEYS = new Set(RENTAL_TAGS.map(tagKey));

export default async function RentalsPage({ searchParams }) {
    const params = await searchParams;
    const nowIso = new Date().toISOString();
    const selectedCategory = params?.category || null;
    const term = String(params?.q || "").trim();
    const sort = parseSort(params?.sort);

    // ?tags=books,nursing  (the old ?tag=books still works)
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
            q: term || null,
            sort: sort === "newest" ? null : sort,
            ...overrides,
        };
        const qs = new URLSearchParams();
        Object.entries(next).forEach(([k, v]) => {
            if (v) qs.set(k, v);
        });
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

    // One query for every active, available listing (same rules as the marketplace).
    // Rentals are picked out in JS (like the marketplace does for tags), so spelling
    // and capitalisation of the tag never hides a rental.
    const [productsRes] = await Promise.all([
        supabase
            .from("products")
            .select(
                `
        id,
        title,
        description,
        price,
        image_urls,
        created_at,
        tags,
        profiles ( full_name, avatar_url ),
        categories ( name )
      `
            )
            .eq("status", "active")
            .eq("is_available", true)
            .not("is_published", "is", false)
            .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
            .order("created_at", { ascending: false }),
    ]);

    const error = productsRes.error;
    if (error) console.error("Error fetching rentals:", error);

    // Merchandise lives on /merchandise
    const rentals = (productsRes.data || []).filter(
        (p) =>
            !isMerch(p) &&
            (p.tags || []).some((t) => RENTAL_KEYS.has(tagKey(t)))
    );



    const inCategory = sortProducts(
        selectedCategory
            ? rentals.filter((p) => p.categories?.name === selectedCategory)
            : rentals,
        sort
    );

    // Items that match the search AND every selected tag
    // (compared with tagKey so "Books" / "books" / "#books" all match)
    const needle = term.toLowerCase();
    const products = inCategory.filter((p) => {
        const keys = new Set((p.tags || []).map(tagKey));
        if (!activeTags.every((k) => keys.has(k))) return false;
        if (needle) {
            const hay = [
                p.title,
                p.description,
                (p.tags || []).join(" "),
                p.categories?.name,
                p.profiles?.full_name,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            if (!hay.includes(needle)) return false;
        }
        return true;
    });

    // Tag list is built from the REMAINING items only, so every tag you can
    // click is guaranteed to return results
    const tagMap = new Map(); // key -> { key, label, count }
    products.forEach((row) => {
        const seenInRow = new Set();
        (row.tags || []).forEach((raw) => {
            const key = tagKey(raw);
            if (!key || RENTAL_KEYS.has(key) || seenInRow.has(key)) return;
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

    const hasFilters = !!(selectedCategory || activeTags.length > 0 || term);

    const pillBase =
        "shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 border";
    const pillOn = "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 hover:border-emerald-800 dark:bg-emerald-700 dark:text-white dark:border-emerald-600 dark:hover:bg-emerald-800 dark:hover:border-emerald-500";
    const pillOff = "bg-stone-200 text-black border-stone-800 hover:bg-emerald-50 hover:border-emerald-700 dark:bg-neutral-800 dark:text-white dark:border-neutral-700 dark:hover:bg-emerald-950 dark:hover:border-emerald-700";

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
        <div className="text-foreground w-full min-h-screen flex flex-col justify-between transition-colors">
            <div className="max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-10 flex-grow">
                <RentalsClawBanner />

                {/* Search (keeps the category and tag filters) */}
                <form action={BASE_PATH} method="get" className="mb-8 flex gap-2">
                    {selectedCategory && <input type="hidden" name="category" value={selectedCategory} />}
                    {activeTags.length > 0 && <input type="hidden" name="tags" value={activeTags.join(",")} />}
                    <div className="relative flex-1">
                        <Search
                            size={16}
                            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500"
                        />
                        <input
                            type="search"
                            name="q"
                            defaultValue={term}
                            placeholder="Search rentals by title, tag, category or seller..."
                            aria-label="Search rentals"
                            className="w-full bg-stone-100 border border-stone-800 rounded-full pl-10 pr-4 py-2.5 text-sm font-medium text-neutral-900 placeholder:text-neutral-500 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/30 transition-all dark:bg-neutral-800 dark:text-white dark:border-neutral-700 dark:placeholder:text-neutral-400 dark:focus:border-emerald-600"
                        />
                    </div>
                    <button
                        type="submit"
                        className="shrink-0 px-5 py-2.5 rounded-full text-sm font-bold bg-emerald-500 hover:bg-emerald-600 border border-emerald-700 text-black transition-colors cursor-pointer"
                    >
                        Search
                    </button>
                </form>

                {/* Tags */}
                {tags.length > 0 && (
                    <section className="mb-8" aria-label="Tags">
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                                <h3 className="flex items-center gap-2 text-sm font-bold text-neutral-900 dark:text-white">
                                    <Tag size={15} className="text-emerald-600 dark:text-emerald-400" />
                                    {activeTags.length > 0 ? "Narrow down further" : "Browse by tag"}
                                </h3>
                                <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                                    {activeTags.length > 0
                                        ? "Add more tags to refine your results."
                                        : "Pick a tag to find what you need."}
                                </p>
                            </div>

                            {activeTags.length > 0 && (
                                <Link
                                    scroll={false}
                                    href={buildHref({ tags: null })}
                                    className="shrink-0 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                                >
                                    Clear tags
                                </Link>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2">{topTags.map(tagPill)}</div>

                        {activeTags.length > 0 && relatedTags.length === 0 && (
                            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                                No other tags on these items.
                            </p>
                        )}

                        {moreTags.length > 0 && (
                            <details className="group mt-4 border-t border-stone-300 pt-3 dark:border-neutral-700">
                                <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-semibold text-neutral-800 hover:text-emerald-700 dark:text-neutral-200 dark:hover:text-emerald-400 [&::-webkit-details-marker]:hidden">
                                    <span className="group-open:hidden">Show {moreTags.length} more</span>
                                    <span className="hidden group-open:inline">Show less</span>
                                    <ChevronDown
                                        size={14}
                                        className="transition-transform group-open:rotate-180"
                                    />
                                </summary>
                                <div className="mt-3 flex flex-wrap gap-2">{moreTags.map(tagPill)}</div>
                            </details>
                        )}
                    </section>
                )}

                {/* Active filters + result count */}
                <div className="mb-6 flex flex-wrap items-center gap-2 min-h-[32px]">
                    <span className="text-sm font-semibold text-foreground mr-1">
                        {error
                            ? ""
                            : `${products.length} rental${products.length === 1 ? "" : "s"}`}
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
                    {term && <FilterChip label={`"${term}"`} href={buildHref({ q: null })} />}
                    {hasFilters && (
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
                        Couldn&apos;t load rentals. Please refresh the page.
                    </div>
                ) : products.length === 0 ? (
                    <div className="text-center py-24 bg-stone-200 rounded-3xl border border-dashed border-neutral-800 dark:bg-neutral-800 dark:border-neutral-700 dark:text-white">
                        <p className="text-neutral-800 text-base font-medium dark:text-white">
                            {rentals.length === 0
                                ? "No rentals are available right now."
                                : selectedCategory
                                    ? `No rentals found in "${selectedCategory}"${activeTags.length
                                        ? ` with ${selectedTagObjs.map((t) => `#${t.label}`).join(" + ")}`
                                        : ""
                                    }.`
                                    : "No rentals match these filters."}
                        </p>
                        {hasFilters && (
                            <Link
                                scroll={false}
                                href={BASE_PATH}
                                className="text-red-500 font-semibold mt-3 inline-block hover:underline text-sm"
                            >
                                Clear filters
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {products.map((product, index) => (
                            <Link
                                href={`/products/${product.id}`}
                                prefetch={false}
                                key={product.id}
                                className="block group transition-all duration-300 hover:-translate-y-1 active:scale-95"
                            >
                                <ProductCard
                                    title={product.title}
                                    price={product.price}
                                    seller={product.profiles?.full_name || "Unknown Seller"}
                                    sellerAvatar={product.profiles?.avatar_url}
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

            <footer className="w-full h-2 bg-background shrink-0" />
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