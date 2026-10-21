import { supabase } from "@/lib/supabase/client";
import ProductCard from "@/components/ProductCard";
import Link from "next/link";
import { isMerch } from "@/lib/merch";
import SortSelect from "@/components/SortSelect";
import { SORT_OPTIONS, parseSort, sortProducts } from "@/lib/sort";
import { LayoutGrid, Search, Tag, ChevronDown, X } from "lucide-react";

export const dynamic = "force-dynamic";

const BASE_PATH = "/categories";
const VISIBLE_TAGS = 12; // tags shown before "Show more"

// "Campus Essentials", "campus-essentials", "#campusessentials" -> "campusessentials"
const tagKey = (t: unknown) =>
    String(t).trim().replace(/^#+/, "").toLowerCase().replace(/[\s_,-]+/g, "");

const tagLabel = (t: unknown) =>
    String(t).trim().replace(/^#+/, "").toLowerCase().replace(/\s+/g, " ");

// Same palette as the merchandise page
const LINE = "border-stone-400 dark:border-neutral-700";
const OUTLINE = "border-stone-800 dark:border-neutral-700";
const pillBase =
    "shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 border";
const pillOn =
    "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 hover:border-emerald-800 dark:bg-emerald-700 dark:text-white dark:border-emerald-600 dark:hover:bg-emerald-800 dark:hover:border-emerald-500";
const pillOff =
    "bg-stone-200 text-black border-stone-800 hover:bg-emerald-50 hover:border-emerald-700 dark:bg-neutral-800 dark:text-white dark:border-neutral-700 dark:hover:bg-emerald-950 dark:hover:border-emerald-700";

// Search params can come through as string | string[] | undefined
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const HIDDEN_TAG_KEYS = new Set(["pending", "expired"]);

function FilterChip({ label, href }: { label: string; href: string }) {
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

export default async function CategoriesPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const resolvedParams = (await searchParams) || {};
    const activeCategory = first(resolvedParams.category) || null;
    const term = (first(resolvedParams.q) || "").trim();
    const sort = parseSort(first(resolvedParams.sort));

    // ?tags=tees,black  (the old ?tag=tees still works)
    const tagsParam = first(resolvedParams.tags) ?? first(resolvedParams.tag) ?? "";
    const activeTags = [...new Set(tagsParam.split(",").map(tagKey).filter(Boolean))];

    const nowIso = new Date().toISOString();

    // 1. Categories for the pill row (Merchandise has its own page)
    const { data: rawCategoriesData } = await supabase
        .from("categories")
        .select("id, name, icon")
        .order("name", { ascending: true });

    const categoriesData = rawCategoriesData || [];

    // 2. Products (active, available, not expired)
    let query = supabase
        .from("products")
        .select(`
      id,
      title,
      description,
      price,
      image_urls,
      created_at,
      tags,
      is_available,
      stock_quantity,
      profiles ( full_name, org_name, is_verified_org ),
      categories!inner ( name )
    `)
        .eq("is_available", true)
        .eq("status", "active")
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order("created_at", { ascending: false });

    if (activeCategory) {
        query = query.eq("categories.name", activeCategory);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Categories fetch error:", error);
    }

    const products: any[] = sortProducts((data || []).filter((p: any) => !isMerch(p)), sort);

    // Build links that keep the other filters intact
    const buildHref = (overrides: Record<string, string | null> = {}) => {
        const next: Record<string, string | null> = {
            category: activeCategory,
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
    const toggleTagHref = (key: string) =>
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

    // Items that match the search AND every selected tag
    // (compared with tagKey so "Tees" / "tees" / "#tees" all match)
    const needle = term.toLowerCase();
    const visible = products.filter((p) => {
        const keys = new Set((p.tags || []).map(tagKey));
        if (!activeTags.every((k) => keys.has(k))) return false;
        if (needle) {
            const hay = [
                p.title,
                p.description,
                (p.tags || []).join(" "),
                p.categories?.name,
                p.profiles?.org_name,
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
    const tagMap = new Map<string, { key: string; label: string; count: number }>();
    visible.forEach((row) => {
        const seenInRow = new Set<string>();
        (row.tags || []).forEach((raw: string) => {
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

    const hasFilters = !!(activeCategory || activeTags.length > 0 || term);

    const tagPill = (t: { key: string; label: string; count: number }) => {
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
        <div className="text-foreground w-full min-h-screen flex flex-col transition-colors select-none">
            <div className="max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-10 flex-grow">

                {/* HEADER SECTION */}
                <div className={`mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b ${LINE} pb-6`}>
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                            <LayoutGrid className="text-amber-500" size={32} /> Browse Categories
                        </h1>
                        <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
                            Filter marketplace items by category, tags, or title search
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className={`px-4 py-2 bg-stone-200 dark:bg-neutral-800 border ${OUTLINE} rounded-2xl text-xs font-bold text-neutral-800 dark:text-neutral-200 shrink-0 w-fit`}>
                            {products.length} {products.length === 1 ? "Item" : "Items"} Listed
                        </div>
                    </div>
                </div>

                {error ? (
                    <div className="text-center py-20 text-red-500 font-semibold">
                        Couldn&apos;t load items. Please refresh the page.
                    </div>
                ) : (
                    <>
                        {/* Search (keeps the category and tag filters) */}
                        <form method="GET" action={BASE_PATH} className="mb-8 flex gap-2" role="search">
                            {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
                            {activeTags.length > 0 && <input type="hidden" name="tags" value={activeTags.join(",")} />}
                            <div className="relative flex-1">
                                <Search
                                    size={16}
                                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500"
                                />
                                <input
                                    key={term}
                                    type="search"
                                    name="q"
                                    defaultValue={term}
                                    placeholder="Search items by name, tag or seller..."
                                    aria-label="Search items"
                                    className="select-text w-full bg-stone-100 border border-stone-800 rounded-full pl-10 pr-4 py-2.5 text-sm font-medium text-neutral-900 placeholder:text-neutral-500 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/30 transition-all dark:bg-neutral-800 dark:text-white dark:border-neutral-700 dark:placeholder:text-neutral-400 dark:focus:border-emerald-600"
                                />
                            </div>
                            <button
                                type="submit"
                                className="shrink-0 px-5 py-2.5 rounded-full text-sm font-bold bg-emerald-500 hover:bg-emerald-600 border border-emerald-700 text-black transition-colors cursor-pointer"
                            >
                                Search
                            </button>
                        </form>

                        {/* Categories: one scrollable row on mobile, wraps on larger screens */}
                        {categoriesData.length > 0 && (
                            <section className="mb-8" aria-label="Categories">
                                <div className="flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
                                    <Link
                                        scroll={false}
                                        href={buildHref({ category: null, tags: null })}
                                        aria-current={!activeCategory ? "page" : undefined}
                                        className={`${pillBase} ${!activeCategory ? pillOn : pillOff}`}
                                    >
                                        All
                                    </Link>
                                    {categoriesData.map((cat) => (
                                        <Link
                                            key={cat.id}
                                            scroll={false}
                                            href={buildHref({ category: cat.name, tags: null })}
                                            aria-current={activeCategory === cat.name ? "page" : undefined}
                                            className={`${pillBase} ${activeCategory === cat.name ? pillOn : pillOff}`}
                                        >
                                            {cat.icon && <span aria-hidden="true">{cat.icon}</span>}
                                            <span>{cat.name}</span>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Tags: selected first, then only tags that exist on the remaining items */}
                        {tags.length > 0 && (
                            <section className="mb-8" aria-label="Tags">
                                <h3 className="text-sm font-semibold text-neutral-800 mb-3 flex items-center gap-1.5 dark:text-neutral-200">
                                    <Tag size={14} />
                                    {activeTags.length > 0
                                        ? "Narrow down further"
                                        : activeCategory
                                            ? `Popular in ${activeCategory}`
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
                        {(hasFilters || visible.length > 0) && (
                            <div className="mb-6 flex flex-wrap items-center gap-2 min-h-[32px]">
                                <span className="text-sm font-semibold text-foreground mr-1">
                                    {visible.length} item{visible.length === 1 ? "" : "s"}
                                </span>
                                {visible.length > 1 && (
                                    <>
                                        <span className="h-4 w-px bg-stone-400 dark:bg-neutral-700" aria-hidden="true" />
                                        <SortSelect value={sort} hrefs={sortHrefs} />
                                    </>
                                )}
                                {activeCategory && (
                                    <FilterChip
                                        label={activeCategory}
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
                        )}



                        {/* PRODUCT GRID */}
                        {visible.length === 0 ? (
                            <div className="text-center py-24 bg-stone-200 rounded-3xl border border-dashed border-neutral-800 dark:bg-neutral-800 dark:border-neutral-700">
                                <p className="text-neutral-800 text-base font-medium dark:text-white">
                                    {products.length === 0
                                        ? "No items listed yet."
                                        : "No items match these filters."}
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
                                {visible.map((product, index) => (
                                    <Link
                                        key={product.id}
                                        href={`/products/${product.id}`}
                                        className="block group transition-all duration-300 hover:-translate-y-1 active:scale-95"
                                    >
                                        <ProductCard
                                            title={product.title}
                                            price={product.price}
                                            seller={product.profiles?.full_name || "Unknown Seller"}
                                            orgName={product.profiles?.org_name}
                                            isVerifiedOrg={product.profiles?.is_verified_org}
                                            image={product.image_urls?.[0] || "/placeholder.png"}
                                            category={product.categories?.name}
                                            tags={product.tags}
                                            stockQuantity={product.stock_quantity}
                                            priority={index < 4}
                                        />
                                    </Link>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}