"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import ProductCard from "@/components/ProductCard";
import ProductReviews from "@/components/ProductReviews";
import { Loader2, Mail, User, Package, Edit, MessageSquare, ShieldCheck, Star, X, Trophy, Shield } from "lucide-react";
import { getListingState } from "@/lib/listingStatus";

interface UserProfile {
  id: string;
  full_name: string | null;
  First_Name?: string | null;
  Last_Name?: string | null;
  avatar_url: string | null;
  email: string | null;
  role: string | null;
  is_verified_org?: boolean;
  org_name?: string | null;
}

interface Product {
  id: string;
  title: string;
  price: number;
  image_urls: string[];
  created_at: string;
  tags: string[];
  stock_quantity?: number;
  categories: { name: string } | null;
  profiles?: {
    is_verified_org: boolean;
    org_name: string | null;
  } | null;
}

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const viewedUserId = String(params?.id || "");

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [soldCount, setSoldCount] = useState(0);
  const [boughtCount, setBoughtCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);

  const isOwnProfile = currentUserId === viewedUserId;

  useEffect(() => {
    if (!viewedUserId) return;
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewedUserId]);

  async function fetchProfile() {
    setLoading(true);

    try {
      // 1. First fetch session to see who is viewing
      const sessionRes = await supabase.auth.getSession();
      const loggedInUserId = sessionRes.data?.session?.user?.id || null;
      setCurrentUserId(loggedInUserId);

      const isSelf = loggedInUserId === viewedUserId;

      // 2. Build dynamic products query depending on whether it's the owner viewing or a public viewer
      let productsQuery = supabase
        .from("products")
        .select(`
          id, 
          title, 
          price, 
          image_urls, 
          created_at, 
          tags, 
          stock_quantity,
          is_available,
          status,
          expires_at,
          categories ( name )
        `)
        .eq("seller_id", viewedUserId);

      // If NOT the owner, restrict database query to only available, non-flagged, non-pending products
      if (!isSelf) {
        productsQuery = productsQuery
          .eq("is_available", true)
          .eq("status", "active");
      }

      productsQuery = productsQuery.order("created_at", { ascending: false });

      const [profileRes, legacyUserRes, productsRes, reviewsRes, summaryRes, soldRes, boughtRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, role, ai_summary, is_verified_org, org_name")
          .eq("id", viewedUserId)
          .maybeSingle(),
        supabase
          .from("users")
          .select("id, First_Name, Last_Name, avatar_url")
          .eq("id", viewedUserId)
          .maybeSingle(),
        productsQuery,
        supabase
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
          .eq("reviewee_id", viewedUserId)
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("ai_summary")
          .eq("id", viewedUserId)
          .maybeSingle(),
        supabase.rpc("count_completed_transactions", { p_user_id: viewedUserId, p_role: "seller" }),
        supabase.rpc("count_completed_transactions", { p_user_id: viewedUserId, p_role: "buyer" }),
      ]);

      const primaryProfile: any = profileRes.data || {};
      const legacy: any = legacyUserRes.data || {};

      const mergedProfile: UserProfile = {
        id: viewedUserId,
        full_name:
          primaryProfile.full_name ||
          `${legacy.First_Name || ""} ${legacy.Last_Name || ""}`.trim() ||
          null,
        avatar_url: primaryProfile.avatar_url || legacy.avatar_url || null,
        email: null,
        role: primaryProfile.role || "user",
        is_verified_org: primaryProfile.is_verified_org || false,
        org_name: primaryProfile.org_name || null,
      };

      setProfileData(mergedProfile);

      if (productsRes.error) throw productsRes.error;

      const rawProducts = (productsRes.data as unknown as Product[]) || [];

      // 🔒 SECONDARY CLIENT SAFEGUARD FILTER: Double check visibility rules
      const visibleProducts = rawProducts.filter((p: any) => {
        if (isSelf) return true;
        return p.is_available && getListingState(p) === "active";
      });

      setProducts(visibleProducts);

      setSoldCount(Number(soldRes.data) || 0);
      setBoughtCount(Number(boughtRes.data) || 0);

      let finalReviews = reviewsRes.data || [];
      if (finalReviews.length === 0) {
        const { data: fallbackReviews } = await supabase
          .from("reviews")
          .select("*")
          .eq("target_user_id", viewedUserId)
          .order("created_at", { ascending: false });
        finalReviews = fallbackReviews || [];
      }

      setReviews(finalReviews);
      if (summaryRes.data?.ai_summary) {
        setAiSummary(summaryRes.data.ai_summary);
      }
    } catch (e) {
      console.error("Profile fetch error:", e);
    } finally {
      setLoading(false);
    }
  }

  const handleStartChat = async () => {
    if (!currentUserId) return router.push("/login");
    setIsStartingChat(true);

    try {
      const { data: roomId, error } = await supabase.rpc("get_or_create_direct_room", {
        p_other_user: viewedUserId,
      });

      if (error) throw error;
      if (roomId) router.push(`/chat/${roomId}`);
    } catch (err) {
      console.error("Failed to start conversation:", err);
    } finally {
      setIsStartingChat(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  const fullName = profileData?.full_name || "Marketplace User";
  const userRole = profileData?.role || "user";
  const isAdmin = userRole.includes("admin");

  const sellerReviews = reviews.filter((r) => r.role_reviewed === "seller");
  const buyerReviews = reviews.filter((r) => r.role_reviewed === "buyer");

  const sellerAvg = sellerReviews.length
    ? (sellerReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / sellerReviews.length).toFixed(1)
    : "0.0";

  const buyerAvg = buyerReviews.length
    ? (buyerReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / buyerReviews.length).toFixed(1)
    : "0.0";

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* HEADER */}
      <div className="bg-card border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 mb-12 shadow-xl flex flex-col md:flex-row items-center md:items-start gap-8">

        {/* AVATAR WITH CONDITIONAL VERIFIED ORG BORDER & CHECKMARK BADGE */}
        <div className="relative shrink-0">
          <div className={`w-32 h-32 rounded-full flex items-center justify-center text-5xl text-primary-foreground font-bold overflow-hidden shadow-lg transition-all ${profileData?.is_verified_org
            ? "border-4 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)] bg-emerald-600"
            : "border-4 border-neutral-300 dark:border-neutral-700 bg-primary"
            }`}>
            {profileData?.avatar_url ? (
              <img src={profileData.avatar_url} className="w-full h-full object-cover" alt="Profile avatar" />
            ) : (
              <span>{fullName?.[0] || "?"}</span>
            )}
          </div>

          {/* Floating verified check badge */}
          {profileData?.is_verified_org && (
            <div className="absolute bottom-1 right-1 bg-emerald-600 text-white p-1.5 rounded-full border-2 border-background shadow-md flex items-center justify-center" title="Verified Official Organization">
              <ShieldCheck size={18} />
            </div>
          )}
        </div>

        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center gap-3 mb-3 justify-center md:justify-start flex-wrap">
            <h1 className="text-3xl font-bold text-foreground">{fullName}</h1>


            {/* OFFICIAL VERIFIED ORG FLOATING BADGE */}
            {profileData?.is_verified_org && (
              <div className="relative group flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 shadow-sm cursor-pointer transition-all hover:bg-emerald-500/30">
                <ShieldCheck size={14} />
                <span>{profileData?.org_name || "Official Merch Store"}</span>

                {/* Floating tooltip box on hover */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-50">
                  <div className="px-3 py-1.5 rounded-xl bg-neutral-900 border border-emerald-500/50 shadow-2xl text-center whitespace-nowrap">
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 block leading-none mb-0.5">Verified Organization</span>
                    <span className="text-xs font-bold text-emerald-100">{profileData?.org_name || fullName}</span>
                  </div>
                  <div className="w-1.5 h-1.5 bg-neutral-900 border-r border-b border-emerald-500/50 transform rotate-45 -mt-0.5" />
                </div>
              </div>
            )}

            {/* SOLD BADGE */}
            <div className="relative group flex items-center justify-center p-2.5 rounded-xl bg-neutral-950 border border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.2)] cursor-pointer transform hover:scale-110 transition-all">
              <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 shadow-[0_0_6px_#10b981]" />
              <Trophy size={26} className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]" />

              <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-50">
                <div className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-emerald-500/50 shadow-2xl text-center whitespace-nowrap">
                  <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400 block leading-none">Items Sold</span>
                  <span className="text-xs font-black text-emerald-200">{soldCount}</span>
                </div>
                <div className="w-1.5 h-1.5 bg-neutral-900 border-r border-b border-emerald-500/50 transform rotate-45 -mt-0.5" />
              </div>
            </div>

            {/* BOUGHT BADGE */}
            <div className="relative group flex items-center justify-center p-2.5 rounded-xl bg-neutral-950 border border-sky-500/60 shadow-[0_0_15px_rgba(56,189,248,0.2)] cursor-pointer transform hover:scale-110 transition-all">
              <div className="absolute top-0 left-0 w-full h-1 bg-sky-500 shadow-[0_0_6px_#38bdf8]" />
              <Shield size={26} className="text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]" />

              <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-50">
                <div className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-sky-500/50 shadow-2xl text-center whitespace-nowrap">
                  <span className="text-[8px] font-black uppercase tracking-widest text-sky-400 block leading-none">Items Bought</span>
                  <span className="text-xs font-black text-sky-200">{boughtCount}</span>
                </div>
                <div className="w-1.5 h-1.5 bg-neutral-900 border-r border-b border-sky-500/50 transform rotate-45 -mt-0.5" />
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4 text-muted-foreground mb-4 justify-center md:justify-start">
            <div className="flex items-center gap-2">
              <User size={16} />
              <span>Account active</span>
            </div>
          </div>

          {/* RATINGS & REVIEWS SCORES + POPUP BUTTON */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-6">
            <div className="flex items-center gap-1.5 bg-neutral-800/90 border border-neutral-700 rounded-xl px-3.5 py-2 text-xs shadow-md">
              <Star size={14} className="fill-yellow-500 text-yellow-500" />
              <span className="font-extrabold text-white">Seller: {sellerAvg}</span>
              <span className="text-neutral-400 font-medium">({sellerReviews.length})</span>
            </div>

            <div className="flex items-center gap-1.5 bg-neutral-800/90 border border-neutral-700 rounded-xl px-3.5 py-2 text-xs shadow-md">
              <Star size={14} className="fill-blue-400 text-blue-400" />
              <span className="font-extrabold text-white">Buyer: {buyerAvg}</span>
              <span className="text-neutral-400 font-medium">({buyerReviews.length})</span>
            </div>

            <button
              onClick={() => setIsReviewsModalOpen(true)}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-bold transition-colors border border-neutral-700 cursor-pointer shadow-md"
            >
              View Reviews ({reviews.length})
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
            {isOwnProfile ? (
              <Link
                href="/profile"
                className="flex items-center gap-2 px-5 py-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-foreground rounded-lg transition-colors border border-neutral-300 dark:border-neutral-700 font-semibold"
              >
                <Edit size={16} /> Edit Profile
              </Link>
            ) : (
              <button
                onClick={handleStartChat}
                disabled={isStartingChat}
                className="flex items-center gap-2 px-5 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-all border border-primary/30 font-semibold disabled:opacity-50"
              >
                {isStartingChat ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <MessageSquare size={16} />
                )}
                Message User
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PRODUCTS */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Package className="text-primary" /> Listings
        </h2>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800">
          <p className="text-muted-foreground mb-4">No listings yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {products.map((product) => (
            <Link
              href={`/products/${product.id}`}
              key={product.id}
              className="block group transition-all duration-300 hover:-translate-y-1"
            >
              <ProductCard
                title={product.title}
                price={product.price}
                seller={fullName}
                orgName={profileData?.org_name}
                isVerifiedOrg={profileData?.is_verified_org || false}
                image={product.image_urls?.[0] || "/placeholder.png"}
                category={product.categories?.name}
                tags={product.tags}
                stockQuantity={product.stock_quantity}
              />
            </Link>
          ))}
        </div>
      )}

      {/* REVIEWS POPUP MODAL */}
      {isReviewsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setIsReviewsModalOpen(false)}
        >
          <div
            className="relative z-10 w-full max-w-2xl max-h-[85vh] bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >

            {/* Modal Header */}
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-white dark:bg-neutral-900 shrink-0">
              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">Community Feedback</h3>
              <button
                onClick={() => setIsReviewsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-white transition-colors p-1 cursor-pointer"
              >
                <X size={22} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto bg-neutral-50 dark:bg-neutral-900/50">
              <ProductReviews
                initialReviews={reviews}
                aiSummary={aiSummary}
              />
            </div>

          </div>
        </div>
      )}
    </div>
  );
}