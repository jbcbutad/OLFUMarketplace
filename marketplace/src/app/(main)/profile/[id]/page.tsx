"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import ProductCard from "@/components/ProductCard";
import { isMerch } from "@/lib/merch";
import ProductReviews from "@/components/ProductReviews";
import {
  Loader2,
  User,
  Package,
  Edit,
  MessageSquare,
  ShieldCheck,
  Star,
  X,
  Tag,
  ShoppingBag,
  MessagesSquare,
} from "lucide-react";
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

/* ---------- small UI pieces ---------- */
const METRIC_TONES = {
  emerald: {
    tile: "border-emerald-300/70 bg-emerald-950 shadow-[0_0_18px_rgba(52,211,153,0.45)]",
    bar: "bg-emerald-400 shadow-[0_0_6px_#34d399]",
    icon: "text-emerald-300 drop-shadow-[0_0_8px_rgba(110,231,183,0.9)]",
    tip: "border-emerald-500/50",
    label: "text-emerald-400",
    value: "text-emerald-200",
    count: "bg-emerald-300 text-emerald-950",
  },
  sky: {
    tile: "border-sky-300/70 bg-sky-950 shadow-[0_0_18px_rgba(56,189,248,0.45)]",
    bar: "bg-sky-400 shadow-[0_0_6px_#38bdf8]",
    icon: "text-sky-300 drop-shadow-[0_0_8px_rgba(125,211,252,0.9)]",
    tip: "border-sky-500/50",
    label: "text-sky-400",
    value: "text-sky-200",
    count: "bg-sky-300 text-sky-950",
  },
};

/* Neon achievement badge. The count is always visible (works on phones);
   hovering or focusing shows the tooltip above the badge. */
function MetricBadge({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tone: "emerald" | "sky";
}) {
  const t = METRIC_TONES[tone];
  return (
    <div
      tabIndex={0}
      aria-label={`${label}: ${value}`}
      className={`group relative flex cursor-pointer items-center justify-center rounded-xl border p-2.5 transition-transform hover:scale-110 focus:scale-110 focus:outline-none ${t.tile}`}
    >
      <div className={`absolute left-0 top-0 h-1 w-full rounded-t-xl ${t.bar}`} />
      <span className={t.icon}>{icon}</span>

      <span
        className={`absolute -bottom-2 -right-2 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-black ring-2 ring-white ${t.count}`}
      >
        {value}
      </span>

      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 flex-col items-center group-hover:flex group-focus:flex">
        <div className={`whitespace-nowrap rounded-lg border bg-neutral-900 px-2.5 py-1 text-center shadow-2xl ${t.tip}`}>
          <span className={`block text-[8px] font-black uppercase leading-none tracking-widest ${t.label}`}>{label}</span>
          <span className={`text-xs font-black ${t.value}`}>{value}</span>
        </div>
        <div className={`-mt-0.5 h-1.5 w-1.5 rotate-45 border-b border-r bg-neutral-900 ${t.tip}`} />
      </div>
    </div>
  );
}

function ReviewsModal({
  onClose,
  reviews,
  aiSummary,
}: {
  onClose: () => void;
  reviews: any[];
  aiSummary: any;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reviews-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-stone-300 bg-white text-neutral-900 shadow-2xl animate-in zoom-in-95 duration-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-stone-200 p-5 dark:border-neutral-800">
          <h3 id="reviews-title" className="flex items-center gap-2 text-xl font-black">
            <MessagesSquare size={20} className="text-emerald-600 dark:text-emerald-400" />
            Community Feedback
            <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-bold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
              {reviews.length}
            </span>
          </h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-stone-200 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto bg-stone-50 p-5 dark:bg-neutral-900/50">
          <ProductReviews initialReviews={reviews} aiSummary={aiSummary} />
        </div>
      </div>
    </div>
  );
}

/* ---------- page ---------- */
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

      // Secondary client safeguard: double check visibility rules
      const visibleProducts = rawProducts.filter((p: any) => {
        if (isSelf) return true;
        if (isMerch(p)) return false; // merch lives on /merchandise
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
      </div>
    );
  }

  const fullName = profileData?.full_name || "Marketplace User";
  const isVerifiedOrg = !!profileData?.is_verified_org;

  const sellerReviews = reviews.filter((r) => r.role_reviewed === "seller");
  const buyerReviews = reviews.filter((r) => r.role_reviewed === "buyer");

  const avg = (list: any[]) =>
    list.length ? (list.reduce((sum, r) => sum + Number(r.rating || 0), 0) / list.length).toFixed(1) : null;
  const sellerAvg = avg(sellerReviews);
  const buyerAvg = avg(buyerReviews);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      {/* HEADER (no overflow-hidden here, so the badge tooltips can extend past the card) */}
      <section className="relative mb-10 rounded-3xl border border-emerald-700 bg-gradient-to-b from-emerald-800 via-emerald-600 to-emerald-400 shadow-sm dark:border-emerald-900 dark:from-emerald-950 dark:via-emerald-800 dark:to-emerald-600">
        {/* Dot pattern: clipping lives on this layer only */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl opacity-20"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />
        <div className="relative px-5 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col items-center gap-6 md:flex-row md:items-center">
            <div className="relative shrink-0">
              <div
                className={`flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 text-5xl font-bold text-white shadow-lg ${isVerifiedOrg
                  ? "border-white bg-emerald-600 ring-4 ring-emerald-200/60"
                  : "border-white/90 bg-emerald-800"
                  }`}
              >
                {profileData?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profileData.avatar_url} className="h-full w-full object-cover" alt="Profile avatar" />
                ) : (
                  <span>{fullName?.[0] || "?"}</span>
                )}
              </div>
              {isVerifiedOrg && (
                <div
                  className="absolute bottom-1 right-1 flex items-center justify-center rounded-full border-2 border-white bg-emerald-600 p-1.5 text-white shadow-md"
                  title="Verified Official Organization"
                >
                  <ShieldCheck size={16} />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
                <h1 className="truncate text-2xl font-black text-white drop-shadow-sm sm:text-3xl">{fullName}</h1>
                {isVerifiedOrg && (
                  <span
                    title="Verified Organization"
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-800 shadow-sm"
                  >
                    <ShieldCheck size={14} />
                    {profileData?.org_name || "Official Merch Store"}
                  </span>
                )}
                <MetricBadge tone="emerald" icon={<Tag size={26} />} label="Items Sold" value={soldCount} />
                <MetricBadge tone="sky" icon={<ShoppingBag size={26} />} label="Items Bought" value={boughtCount} />
              </div>

              <div className="mt-3 flex items-center justify-center gap-2 text-sm text-white/95 md:justify-start">
                <User size={15} className="shrink-0" /> Account active
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 md:justify-start">
                <div className="flex items-center gap-1.5 rounded-xl border border-white bg-white px-3.5 py-2 text-xs shadow-sm">
                  <Star size={14} className="fill-yellow-500 text-yellow-500" />
                  <span className="font-extrabold text-neutral-900">Seller: {sellerAvg ?? "—"}</span>
                  <span className="font-medium text-neutral-500">({sellerReviews.length})</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl border border-white bg-white px-3.5 py-2 text-xs shadow-sm">
                  <Star size={14} className="fill-blue-500 text-blue-500" />
                  <span className="font-extrabold text-neutral-900">Buyer: {buyerAvg ?? "—"}</span>
                  <span className="font-medium text-neutral-500">({buyerReviews.length})</span>
                </div>
                <button
                  onClick={() => setIsReviewsModalOpen(true)}
                  className="cursor-pointer rounded-xl border border-emerald-950 bg-emerald-950 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-900"
                >
                  View Reviews ({reviews.length})
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                {isOwnProfile ? (
                  <Link
                    href="/profile"
                    className="inline-flex items-center gap-2 rounded-xl border border-white bg-white px-4 py-2.5 text-sm font-bold text-emerald-900 shadow-sm transition-colors hover:bg-emerald-50"
                  >
                    <Edit size={16} /> Edit Profile
                  </Link>
                ) : (
                  <button
                    onClick={handleStartChat}
                    disabled={isStartingChat}
                    className="inline-flex items-center gap-2 rounded-xl border border-white bg-white px-4 py-2.5 text-sm font-bold text-emerald-900 shadow-sm transition-colors hover:bg-emerald-50 disabled:opacity-60"
                  >
                    {isStartingChat ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
                    Message User
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* LISTINGS */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-3 text-2xl font-black text-foreground">
          <Package className="text-emerald-600 dark:text-emerald-400" /> Listings
          <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-sm font-bold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            {products.length}
          </span>
        </h2>
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-400 bg-stone-100 py-20 text-center dark:border-neutral-700 dark:bg-neutral-900">
          <Package size={32} className="mx-auto mb-3 text-neutral-400" />
          <p className="font-medium text-neutral-600 dark:text-neutral-400">No listings yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <Link
              href={`/products/${product.id}`}
              key={product.id}
              className="group block transition-all duration-300 hover:-translate-y-1 active:scale-95"
            >
              <ProductCard
                title={product.title}
                price={product.price}
                seller={fullName}
                orgName={profileData?.org_name}
                isVerifiedOrg={isVerifiedOrg}
                image={product.image_urls?.[0] || "/placeholder.png"}
                category={product.categories?.name}
                tags={product.tags}
                stockQuantity={product.stock_quantity}
              />
            </Link>
          ))}
        </div>
      )}

      {isReviewsModalOpen && (
        <ReviewsModal onClose={() => setIsReviewsModalOpen(false)} reviews={reviews} aiSummary={aiSummary} />
      )}
    </div>
  );
}