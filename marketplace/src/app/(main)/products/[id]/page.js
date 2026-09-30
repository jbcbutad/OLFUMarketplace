"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Tag, Flag, AlertTriangle, Loader2, Check, Heart, ShieldCheck } from "lucide-react";
import ProductReviews from "@/components/ProductReviews";
import ProductActions from "@/components/ProductActions";
import OwnerBanner from "@/components/OwnerBanner";

export default function ProductDetailPage({ params }) {
  const [resolvedParams, setResolvedParams] = useState(null);
  const [product, setProduct] = useState(null);
  const [allReviews, setAllReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  // Favorite State
  const [isFavorited, setIsFavorited] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);

  // Report Modal States
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Toast State
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "info" }), 3500);
  };

  useEffect(() => {
    async function resolveParamsAndFetch() {
      const p = await params;
      setResolvedParams(p);
      const productId = p?.id;

      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Fetch Product Details
      const { data: prodData, error } = await supabase
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
          status,
          updated_at,
          stock_quantity,
          listing_duration,
          seller_id,
          profiles!products_seller_id_fkey (
            id,
            full_name,
            email,
            avatar_url,
            "First_Name",
            "Last_Name",
            ai_summary,
            is_verified_org,
            org_name
          ),
          categories ( name )
        `)
        .eq("id", productId)
        .maybeSingle();

      if (error) console.error("Product detail fetch error:", error);
      setProduct(prodData);

      if (prodData) {
        // Fetch Seller Reviews
        const { data: revData } = await supabase
          .from("reviews")
          .select(`
            id,
            rating,
            comment,
            role_reviewed,
            sentiment_label,
            created_at,
            reviewer_id,
            profiles:reviewer_id (
              full_name,
              "First_Name",
              "Last_Name",
              avatar_url
            )
          `)
          .eq("reviewee_id", prodData.seller_id)
          .order("created_at", { ascending: false });

        setAllReviews(revData || []);

        // Check if current user favorited this product
        if (user) {
          const { data: favData } = await supabase
            .from("favorites")
            .select("id")
            .eq("user_id", user.id)
            .eq("product_id", prodData.id)
            .maybeSingle();

          if (favData) setIsFavorited(true);
        }
      }

      setLoading(false);
    }

    resolveParamsAndFetch();
  }, [params]);

  const handleToggleFavorite = async () => {
    if (!currentUser) {
      showToast("Please log in to save favorites.", "error");
      return;
    }

    setTogglingFavorite(true);

    try {
      if (isFavorited) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", currentUser.id)
          .eq("product_id", product.id);

        if (error) throw error;
        setIsFavorited(false);
        showToast("Removed from favorites.", "info");
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: currentUser.id, product_id: product.id });

        if (error) throw error;
        setIsFavorited(true);
        showToast("Added to favorites!", "success");
      }
    } catch (err) {
      showToast("Error updating favorites: " + err.message, "error");
    } finally {
      setTogglingFavorite(false);
    }
  };

  const handleReportListing = async () => {
    if (!currentUser) {
      showToast("You must be logged in to report a listing.", "error");
      return;
    }
    if (!reportReason.trim()) return;

    setSubmittingReport(true);
    try {
      const { error } = await supabase.from("reports").insert({
        reporter_id: currentUser.id,
        reported_id: product.seller_id,
        reason: `[Product Report: "${product.title}"] - ${reportReason.trim()}`,
        context_room_id: null,
        product_id: product.id,
        status: "pending",
      });

      if (error) throw error;

      showToast("Report submitted successfully to moderation queue.", "success");
      setShowReportModal(false);
      setReportReason("");
    } catch (err) {
      showToast("Failed to submit report: " + (err.message || err), "error");
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="text-foreground min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-foreground" size={32} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-foreground min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Listing not found.</h1>
        <p className="text-muted-foreground mb-6 text-sm">
          This product may have been deleted or is no longer available.
        </p>
        <Link
          href="/marketplace"
          className="px-5 py-2.5 bg-foreground text-background font-bold rounded-xl hover:opacity-90 transition-opacity text-sm"
        >
          Back to Marketplace
        </Link>
      </div>
    );
  }

  const profile = product.profiles;
  const isVerifiedOrg = profile?.is_verified_org;
  const orgName = profile?.org_name;

  // Real Full Name (Never replaced with org_name)
  const derivedFullName = `${profile?.First_Name || ""} ${profile?.Last_Name || ""}`.trim();
  const sellerName = profile?.full_name || (derivedFullName.length > 0 ? derivedFullName : null) || profile?.email || "Unknown Seller";
  const sellerEmail = profile?.email || "";

  // Check if product is categorized as Merchandise
  const isMerchandiseCategory = product.categories?.name === "Merchandise";
  const images = product.image_urls?.length > 0 ? product.image_urls : ["/placeholder.png"];

  return (
    <div className="text-foreground w-full min-h-screen flex flex-col justify-between transition-colors relative">

      {toast.show && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[10000] animate-in fade-in slide-in-from-top-4 duration-200">
          <div className={`px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2.5 ${toast.type === "success"
            ? "bg-foreground text-background border-transparent"
            : toast.type === "error"
              ? "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400"
              : "bg-muted border-border text-foreground"
            }`}>
            {toast.type === "success" && <Check size={15} className="text-emerald-500 shrink-0" />}
            {toast.message}
          </div>
        </div>
      )}

      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow">

        <div className="flex items-center justify-between mb-6">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-semibold transition-colors"
          >
            <ArrowLeft size={16} /> Back to Marketplace
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleFavorite}
              disabled={togglingFavorite}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${isFavorited
                ? "bg-rose-500/10 border-rose-500/40 text-rose-500 hover:bg-rose-500/20"
                : "bg-muted border-border text-muted-foreground hover:text-foreground"
                }`}
            >
              <Heart
                size={15}
                className={isFavorited ? "fill-rose-500 text-rose-500" : ""}
              />
              {isFavorited ? "Saved" : "Favorite"}
            </button>

            {currentUser?.id !== product.seller_id && (
              <button
                onClick={() => setShowReportModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer"
              >
                <Flag size={13} /> Report Listing
              </button>
            )}
          </div>
        </div>

        <OwnerBanner
          sellerId={product.seller_id}
          productId={product.id}
          status={product.status}
          updatedAt={product.updated_at}
        />

        {/* 👉 ADDED FLAG BANNER HERE */}
        {product.status === "flagged" && (
          <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl mb-6 flex items-center gap-3 text-rose-600 dark:text-rose-400">
            <AlertTriangle size={20} className="shrink-0" />
            <div className="text-xs font-bold">
              <span className="uppercase tracking-wider block font-black">Under Safety Review (Flagged)</span>
              This listing has triggered automated moderation flags and is currently hidden from public view pending admin review.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start mb-12"></div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start mb-12">

          <div className="lg:col-span-5 flex flex-col gap-4 lg:sticky lg:top-6">
            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-muted border border-border shadow-xs">
              <Image
                src={images[0]}
                alt={product.title}
                fill
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-cover"
                priority
              />
            </div>

            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-muted border border-border hover:border-foreground transition-colors cursor-pointer"
                  >
                    <Image
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              {/* CATEGORY & MERCH BADGES */}
              <div className="flex items-center gap-2 flex-wrap">
                {product.categories?.name && (
                  <span className="inline-block px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    {product.categories.name}
                  </span>
                )}

                {/* ONLY SHOWN IF CATEGORY IS MERCHANDISE AND SELLER IS VERIFIED */}
                {isMerchandiseCategory && isVerifiedOrg && (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    Verified Org Merch
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-foreground tracking-tight leading-tight">
                {product.title}
              </h1>

              <div className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 flex items-baseline gap-2">
                <span>₱{Number(product.price).toLocaleString()}</span>
                {product.tags?.map(t => t.toLowerCase()).includes("rentals") && (
                  <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                    / Day
                  </span>
                )}
              </div>

              {product.stock_quantity !== null && product.stock_quantity !== undefined && (
                <div className="flex items-center gap-2 mt-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-foreground">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{product.stock_quantity} left in stock</span>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-border/60">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Description
                </h3>
                <p className="text-foreground/90 text-sm sm:text-base leading-relaxed whitespace-pre-line font-normal">
                  {product.description || "No description provided for this listing."}
                </p>
              </div>

              {product.tags?.length > 0 && (
                <div className="pt-2">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <Tag size={13} /> Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {product.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 rounded-xl bg-muted text-muted-foreground text-xs font-semibold border border-border"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-border">
              <ProductActions
                product={product}
                profile={profile}
                sellerName={sellerName}
                sellerEmail={sellerEmail}
                isVerifiedOrg={isVerifiedOrg}
                orgName={orgName}
              />
            </div>
          </div>
        </div>

        <ProductReviews
          initialReviews={allReviews || []}
          aiSummary={profile?.ai_summary}
          sellerName={sellerName}
        />

      </div>

      {showReportModal && (
        <div
          className="fixed inset-0 bg-black/75 z-[9999] backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowReportModal(false)}
        >
          <div
            className="relative z-10 w-full max-w-md bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mb-3 border border-rose-500/20">
              <AlertTriangle size={20} />
            </div>
            <h3 className="text-lg font-bold mb-1">Report Listing</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
              Let our moderation team know why this listing or item violates platform rules.
            </p>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {["Counterfeit Item", "Prohibited Good", "Misleading Pricing", "Spam Listing"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReportReason((prev) => (prev ? `${prev} - ${preset}` : preset))}
                  className="px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                >
                  + {preset}
                </button>
              ))}
            </div>

            <textarea
              className="w-full min-h-[90px] bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-xs font-medium text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-400 dark:focus:ring-neutral-500 resize-none mb-4 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              placeholder="Describe why you are reporting this product..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowReportModal(false); setReportReason(""); }}
                className="px-4 py-2 text-xs font-bold border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-700 dark:text-neutral-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleReportListing}
                disabled={!reportReason.trim() || submittingReport}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                {submittingReport && <Loader2 size={13} className="animate-spin" />}
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}