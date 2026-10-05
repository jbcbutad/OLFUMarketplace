"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import OrgBanner from "@/components/OrgBanner";
import { Loader2, ShoppingBag, Plus, Search, Tag, ChevronDown, X, Building2 } from "lucide-react";

const BASE_PATH = "/merchandise";
const VISIBLE_TAGS = 12; // tags shown before "Show more"

// "Campus Essentials", "campus-essentials", "#campusessentials" -> "campusessentials"
const tagKey = (t) =>
  String(t).trim().replace(/^#+/, "").toLowerCase().replace(/[\s_,-]+/g, "");

const tagLabel = (t) =>
  String(t).trim().replace(/^#+/, "").toLowerCase().replace(/\s+/g, " ");

// Every merch listing carries tags like these, so they're useless as filters
const COMMON_TAG_KEYS = new Set(["officialmerch", "merch", "merchandise"]);

// Merch is sold by organizations, so that's the useful way to split it
// (every item is in the Merchandise category, so a category filter would only
// ever have one choice).
const orgOf = (p) => p.profiles?.org_name || p.profiles?.full_name || "Unknown organization";

// Same palette as the marketplace
const LINE = "border-stone-400 dark:border-neutral-700";
const OUTLINE = "border-stone-800 dark:border-neutral-700";
const pillBase =
  "shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 border";
const pillOn =
  "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 hover:border-emerald-800 dark:bg-emerald-700 dark:text-white dark:border-emerald-600 dark:hover:bg-emerald-800 dark:hover:border-emerald-500";
const pillOff =
  "bg-stone-200 text-black border-stone-800 hover:bg-emerald-50 hover:border-emerald-700 dark:bg-neutral-800 dark:text-white dark:border-neutral-700 dark:hover:bg-emerald-950 dark:hover:border-emerald-700";

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

function MerchandiseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedOrg = searchParams.get("org") || null;
  const term = (searchParams.get("q") || "").trim();

  // ?tags=tees,black  (the old ?tag=tees still works)
  const tagsParam = searchParams.get("tags") ?? searchParams.get("tag") ?? "";
  const activeTags = useMemo(
    () => [...new Set(tagsParam.split(",").map(tagKey).filter(Boolean))],
    [tagsParam]
  );

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isVerifiedOrg, setIsVerifiedOrg] = useState(false);

  useEffect(() => {
    fetchMerchandise();
    checkOrgVerification();
  }, []);

  const checkOrgVerification = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_verified_org")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profile?.is_verified_org) {
        setIsVerifiedOrg(true);
      }
    } catch (err) {
      console.error("Error checking org verification:", err);
    }
  };

  const fetchMerchandise = async () => {
    try {
      setLoading(true);
      setError(false);

      // Computed at fetch time so it is always current, even if the page stays open
      const nowIso = new Date().toISOString();

      // 👉 Strict Query: Requires an active product, not past its expiry date,
      // AND an actively verified organization profile
      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          title,
          description,
          price,
          image_urls,
          created_at,
          tags,
          status,
          is_available,
          stock_quantity,
          expires_at,
          profiles!inner ( full_name, org_name, is_verified_org ),
          categories!inner ( name )
        `)
        .eq("is_available", true)
        .eq("status", "active")
        .eq("categories.name", "Merchandise")
        .eq("profiles.is_verified_org", true) // 👈 Automatically hides items if organization verification is revoked
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`) // 👈 Hides drops that expired but the hourly job hasn't flipped yet
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Merchandise fetch error with inner join:", error);
        setError(true);
        setProducts([]);
      } else {
        setProducts(data || []);
      }
    } catch (err) {
      console.error("Error fetching merchandise:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Build links that keep the other filters intact
  const buildHref = (overrides = {}) => {
    const next = {
      org: selectedOrg,
      tags: activeTags.join(",") || null,
      q: term || null,
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

  const handleSearch = (e) => {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("q") || "").trim();
    router.push(buildHref({ q: value || null }), { scroll: false });
  };

  // Organizations that have items listed
  const orgs = useMemo(
    () => Array.from(new Set(products.map(orgOf))).sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const inOrg = useMemo(
    () => (selectedOrg ? products.filter((p) => orgOf(p) === selectedOrg) : products),
    [products, selectedOrg]
  );

  // Items that match the search AND every selected tag
  // (compared with tagKey so "Tees" / "tees" / "#tees" all match)
  const visible = useMemo(() => {
    const needle = term.toLowerCase();
    return inOrg.filter((p) => {
      const keys = new Set((p.tags || []).map(tagKey));
      if (!activeTags.every((k) => keys.has(k))) return false;
      if (needle) {
        const hay = [p.title, p.description, (p.tags || []).join(" "), orgOf(p), p.profiles?.full_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [inOrg, activeTags, term]);

  // Tag list is built from the REMAINING items only, so every tag you can
  // click is guaranteed to return results
  const { tags, selectedTagObjs, relatedTags } = useMemo(() => {
    const map = new Map(); // key -> { key, label, count }
    visible.forEach((row) => {
      const seenInRow = new Set();
      (row.tags || []).forEach((raw) => {
        const key = tagKey(raw);
        if (!key || COMMON_TAG_KEYS.has(key) || seenInRow.has(key)) return;
        seenInRow.add(key);

        const label = tagLabel(raw);
        const existing = map.get(key);
        if (!existing) {
          map.set(key, { key, label, count: 1 });
        } else {
          existing.count += 1;
          if (/[\s-]/.test(label) && !/[\s-]/.test(existing.label)) {
            existing.label = label; // prefer the more readable variant
          }
        }
      });
    });

    const selected = activeTags.map((k) => map.get(k) || { key: k, label: k, count: 0 });
    const related = Array.from(map.values())
      .filter((t) => !activeTags.includes(t.key))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    return {
      selectedTagObjs: selected,
      relatedTags: related,
      tags: [...selected, ...related], // selected first
    };
  }, [visible, activeTags]);

  const topTags = tags.slice(0, VISIBLE_TAGS);
  const moreTags = tags.slice(VISIBLE_TAGS);

  const hasFilters = !!(selectedOrg || activeTags.length > 0 || term);

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
    <div className="text-foreground w-full min-h-screen flex flex-col transition-colors select-none">
      <div className="max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-10 flex-grow">

        {/* HEADER SECTION */}
        <div className={`mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b ${LINE} pb-6`}>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
              <ShoppingBag className="text-amber-500" size={32} /> Official Merchandise
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
              Browse official campus uniforms, organization merch, and apparel
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className={`px-4 py-2 bg-stone-200 dark:bg-neutral-800 border ${OUTLINE} rounded-2xl text-xs font-bold text-neutral-800 dark:text-neutral-200 shrink-0 w-fit`}>
              {products.length} {products.length === 1 ? "Item" : "Items"} Listed
            </div>

            {/* 👉 CREATION BUTTON VISIBLE ONLY TO VERIFIED ORG SELLERS */}
            {isVerifiedOrg && (
              <Link
                href="/create-listing?merch=true"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-md transition-all active:scale-95"
              >
                <Plus size={16} /> Create Merch Listing
              </Link>
            )}
          </div>
        </div>

        {/* CALL-TO-ACTION BANNER FOR ORGANIZATIONS */}
        <OrgBanner />

        {loading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="animate-spin text-neutral-500" size={32} />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-500 font-semibold">
            Couldn&apos;t load merchandise. Please refresh the page.
          </div>
        ) : (
          <>
            {/* Search (keeps the organization and tag filters) */}
            <form onSubmit={handleSearch} className="mb-8 flex gap-2" role="search">
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
                  placeholder="Search merch by name, tag or organization..."
                  aria-label="Search merchandise"
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

            {/* Organizations: one scrollable row on mobile, wraps on larger screens */}
            {orgs.length > 1 && (
              <section className="mb-8" aria-label="Organizations">
                <div className="flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
                  <Link
                    scroll={false}
                    href={buildHref({ org: null, tags: null })}
                    aria-current={!selectedOrg ? "page" : undefined}
                    className={`${pillBase} ${!selectedOrg ? pillOn : pillOff}`}
                  >
                    All
                  </Link>
                  {orgs.map((name) => (
                    <Link
                      key={name}
                      scroll={false}
                      href={buildHref({ org: name, tags: null })}
                      aria-current={selectedOrg === name ? "page" : undefined}
                      className={`${pillBase} ${selectedOrg === name ? pillOn : pillOff}`}
                    >
                      <Building2 size={14} className="shrink-0" aria-hidden="true" />
                      <span>{name}</span>
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
                    : selectedOrg
                      ? `Popular from ${selectedOrg}`
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
            {hasFilters && (
              <div className="mb-6 flex flex-wrap items-center gap-2 min-h-[32px]">
                <span className="text-sm font-semibold text-foreground mr-1">
                  {visible.length} item{visible.length === 1 ? "" : "s"}
                </span>
                {selectedOrg && (
                  <FilterChip
                    label={selectedOrg}
                    href={buildHref({ org: null, tags: null })}
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
                <Link
                  scroll={false}
                  href={BASE_PATH}
                  className="ml-1 inline-flex items-center rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 transition-colors"
                >
                  Clear all
                </Link>
              </div>
            )}

            {/* PRODUCT GRID */}
            {visible.length === 0 ? (
              <div className="text-center py-24 bg-stone-200 rounded-3xl border border-dashed border-neutral-800 dark:bg-neutral-800 dark:border-neutral-700">
                <p className="text-neutral-800 text-base font-medium dark:text-white">
                  {products.length === 0
                    ? "No merchandise products listed yet."
                    : "No merchandise matches these filters."}
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
                {visible.map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.id}`}
                    className="block group transition-all duration-300 hover:-translate-y-1 active:scale-95"
                  >
                    <ProductCard
                      title={product.title}
                      price={product.price}
                      seller={product.profiles?.full_name}
                      orgName={product.profiles?.org_name}
                      isVerifiedOrg={product.profiles?.is_verified_org}
                      image={product.image_urls?.[0]}
                      category={product.categories?.name}
                      tags={product.tags}
                      stockQuantity={product.stock_quantity}
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

// useSearchParams needs a Suspense boundary in the App Router
export default function MerchandisePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="animate-spin text-neutral-500" size={32} />
        </div>
      }
    >
      <MerchandiseContent />
    </Suspense>
  );
}