"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import OrgBanner from "@/components/OrgBanner";
import { Loader2, ShoppingBag, Plus, ShieldCheck } from "lucide-react";

export default function MerchandisePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
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

      // Computed at fetch time so it is always current, even if the page stays open
      const nowIso = new Date().toISOString();

      // 👉 Strict Query: Requires an active product, not past its expiry date,
      // AND an actively verified organization profile
      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          title,
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
        setProducts([]);
      } else {
        setProducts(data || []);
      }
    } catch (err) {
      console.error("Error fetching merchandise:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-foreground w-full min-h-screen flex flex-col transition-colors select-none">
      <div className="max-w-screen-2xl w-full mx-auto px-4 sm:px-6 py-10 flex-grow">

        {/* HEADER SECTION */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
              <ShoppingBag className="text-amber-500" size={32} /> Official Merchandise
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Browse official campus uniforms, organization merch, and apparel
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-4 py-2 bg-card border border-border rounded-2xl text-xs font-bold text-muted-foreground shrink-0 w-fit">
              {products.length} {products.length === 1 ? "Item" : "Items"} Listed
            </div>

            {/* 👉 CREATION BUTTON VISIBLE ONLY TO VERIFIED ORG SELLERS */}
            {isVerifiedOrg && (
              <Link
                href="/listings/create?merch=true"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-md transition-all active:scale-95"
              >
                <Plus size={16} /> Create Merch Listing
              </Link>
            )}
          </div>
        </div>

        {/* CALL-TO-ACTION BANNER FOR ORGANIZATIONS */}
        <OrgBanner />

        {/* PRODUCT GRID */}
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="animate-spin text-muted-foreground" size={32} />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-border">
            <p className="text-muted-foreground font-semibold text-sm">
              No merchandise products listed yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {products.map((product) => {
              return (
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
