"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, ImageOff, PackageSearch, Search, UserCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

/* ---------- config: adjust to match your project ---------- */
const RENTAL_TAGS = ["Rentals", "rentals"]; // tag match is case-sensitive, so list both spellings
const productHref = (id: string) => `/products/${id}`;
const SELLERS_TABLE = "users"; // or "profiles"

type Product = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  price_type: string | null;
  seller_id: string;
  created_at: string;
  image_urls: string[] | null;
  condition: string | null;
  is_available: boolean | null;
};
type Seller = { name: string; avatar?: string };
type Sort = "newest" | "price-asc" | "price-desc";

const peso = (n: number | null) =>
  n == null ? "—" : `₱${Number(n).toLocaleString("en-PH")}`;

export default function RentalsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<Map<string, Seller>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [availableOnly, setAvailableOnly] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      // 1) products tagged Rentals, no embedded join
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, title, description, price, price_type, seller_id, created_at, image_urls, condition, is_available, tags"
        )
        .overlaps("tags", RENTAL_TAGS)
        .eq("is_published", true)
        .eq("status", "active")
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order("created_at", { ascending: false });

      if (!alive) return;
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const rows = (data ?? []) as Product[];
      setItems(rows);
      setLoading(false);

      // 2) seller names in a second query (needs no foreign key; skipped quietly if RLS blocks it)
      const ids = [...new Set(rows.map((r) => r.seller_id).filter(Boolean))];
      if (!ids.length) return;
      const { data: us, error: uErr } = await supabase
        .from("profiles")
        .select('id, full_name, "First_Name", "Last_Name", avatar_url')
        .in("id", ids);
      if (!alive || uErr || !us) return;
      setSellers(
        new Map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          us.map((u: any) => [
            u.id,
            {
              name: u.full_name ?? (`${u.First_Name ?? ""} ${u.Last_Name ?? ""}`.trim() || "OLFU student"),
              avatar: u.avatar_url ?? u.avatar ?? undefined,
            },
          ])
        )
      );
    })();

    return () => {
      alive = false;
    };
  }, []);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = items.filter(
      (p) =>
        (!availableOnly || p.is_available !== false) &&
        (!term ||
          p.title?.toLowerCase().includes(term) ||
          p.description?.toLowerCase().includes(term))
    );
    if (sort === "price-asc") list = [...list].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    if (sort === "price-desc") list = [...list].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    return list;
  }, [items, q, sort, availableOnly]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CalendarClock className="h-6 w-6 text-emerald-600" />
          Rentals
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Borrow textbooks, equipment and gear from fellow OLFU students.
        </p>
      </header>

      {/* controls */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search rentals..."
            className="w-full rounded-full border border-neutral-200 bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-emerald-500 dark:border-neutral-800 dark:bg-neutral-900"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm outline-none dark:border-neutral-800 dark:bg-neutral-900"
        >
          <option value="newest">Newest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
            className="h-4 w-4 accent-emerald-600"
          />
          Available only
        </label>
      </div>

      {/* states */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          Error loading rentals: {error}
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <div className="aspect-square bg-neutral-200 dark:bg-neutral-800" />
              <div className="space-y-2 p-3">
                <div className="h-4 w-3/4 rounded bg-neutral-200 dark:bg-neutral-800" />
                <div className="h-4 w-1/3 rounded bg-neutral-200 dark:bg-neutral-800" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-20 text-center text-neutral-500">
          <PackageSearch className="h-10 w-10" />
          <p className="font-medium">No rentals found</p>
          <p className="text-sm">
            {items.length ? "Try a different search or turn off the availability filter." : "Nothing has been listed for rent yet."}
          </p>
        </div>
      )}

      {/* grid */}
      {!loading && visible.length > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {visible.map((p) => {
            const img = p.image_urls?.[0];
            const seller = sellers.get(p.seller_id);
            const unavailable = p.is_available === false;
            return (
              <Link
                key={p.id}
                href={productHref(p.id)}
                className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="relative aspect-square bg-neutral-100 dark:bg-neutral-800">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt={p.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-neutral-400">
                      <ImageOff className="h-8 w-8" />
                    </div>
                  )}
                  <span
                    className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${unavailable ? "bg-neutral-800/80 text-white" : "bg-emerald-600 text-white"
                      }`}
                  >
                    {unavailable ? "Rented out" : "Available"}
                  </span>
                </div>
                <div className="space-y-1 p-3">
                  <h3 className="line-clamp-1 text-sm font-semibold">{p.title}</h3>
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    {peso(p.price)}
                    {p.price_type && p.price_type !== "Fixed" && (
                      <span className="ml-1 text-xs font-medium text-neutral-500">/ {p.price_type}</span>
                    )}
                  </p>
                  <div className="flex items-center justify-between pt-1 text-xs text-neutral-500">
                    <span className="flex min-w-0 items-center gap-1">
                      {seller?.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={seller.avatar} alt="" className="h-4 w-4 rounded-full object-cover" />
                      ) : (
                        <UserCircle2 className="h-4 w-4 shrink-0" />
                      )}
                      <span className="truncate">{seller?.name ?? "OLFU student"}</span>
                    </span>
                    {p.condition && <span className="shrink-0">{p.condition}</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}