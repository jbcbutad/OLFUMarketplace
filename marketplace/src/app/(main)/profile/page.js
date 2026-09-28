"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import ProductReviews from "@/components/ProductReviews";
import {
  User,
  Mail,
  Package,
  Loader2,
  Edit,
  ExternalLink,
  Camera,
  X,
  ShieldCheck,
  Star,
  Trophy,
  Shield
} from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
  const router = useRouter();

  const [profileData, setProfileData] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [myProducts, setMyProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [aiSummary, setAiSummary] = useState(null);
  const [soldCount, setSoldCount] = useState(0);
  const [boughtCount, setBoughtCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);

  // Edit Profile States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
    avatarUrl: ""
  });

  useEffect(() => {
    fetchProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProfileData = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push("/login");
      return;
    }

    const userId = session.user.id;
    setAuthEmail(session.user.email || "");

    try {
      const [
        profileRes,
        userRes,
        productsResponse,
        reviewsRes,
        summaryRes,
        soldRes,
        boughtRes
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, role, is_verified_org, org_name")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("users")
          .select("id, First_Name, Last_Name, Middle_Name, avatar_url")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("products")
          .select("id, title, price, image_urls, created_at, tags, is_available, status, stock_quantity, categories(name)")
          .eq("seller_id", userId)
          .order("created_at", { ascending: false }),
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
          .eq("reviewee_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("seller_summaries")
          .select("summary, pros, cons")
          .eq("seller_id", userId)
          .maybeSingle(),
        supabase
          .from("transactions")
          .select("*", { count: "exact", head: true })
          .eq("seller_id", userId)
          .eq("status", "completed"),
        supabase
          .from("transactions")
          .select("*", { count: "exact", head: true })
          .eq("buyer_id", userId)
          .eq("status", "completed"),
      ]);

      const profileRole = profileRes.data?.role || "user";
      const legacy = userRes.data || {};
      const primaryProfile = profileRes.data || {};

      const mergedProfile = {
        id: userId,
        First_Name: legacy.First_Name || "",
        Last_Name: legacy.Last_Name || "",
        Middle_Name: legacy.Middle_Name || "",
        full_name: primaryProfile.full_name || `${legacy.First_Name || ""} ${legacy.Last_Name || ""}`.trim(),
        avatar_url: primaryProfile.avatar_url || legacy.avatar_url || "",
        role: profileRole,
        is_verified_org: primaryProfile.is_verified_org || false,
        org_name: primaryProfile.org_name || null
      };

      setProfileData(mergedProfile);
      setEditForm({
        firstName: mergedProfile.First_Name,
        lastName: mergedProfile.Last_Name,
        middleName: mergedProfile.Middle_Name,
        avatarUrl: mergedProfile.avatar_url
      });

      if (productsResponse.data) {
        setMyProducts(productsResponse.data);
      }

      setSoldCount(soldRes.count || 0);
      setBoughtCount(boughtRes.count || 0);

      let finalReviews = reviewsRes.data || [];
      if (finalReviews.length === 0) {
        const { data: fallbackReviews } = await supabase
          .from("reviews")
          .select("*")
          .eq("target_user_id", userId)
          .order("created_at", { ascending: false });
        finalReviews = fallbackReviews || [];
      }

      setReviews(finalReviews);
      if (summaryRes.data) setAiSummary(summaryRes.data);

    } catch (error) {
      console.error("Error fetching profile data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File is too large. Please select an image under 5MB.");
      return;
    }

    setIsUpdating(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${profileData.id}-${Date.now()}.${fileExt}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setEditForm(prev => ({ ...prev, avatarUrl: publicUrl }));
    } catch (err) {
      console.error("Upload Error:", err);
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsUpdating(true);

    const updatedFullName = `${editForm.firstName} ${editForm.lastName}`.trim();

    try {
      await Promise.all([
        supabase
          .from("profiles")
          .update({
            full_name: updatedFullName,
            avatar_url: editForm.avatarUrl
          })
          .eq("id", profileData.id),
        supabase
          .from("users")
          .update({
            First_Name: editForm.firstName,
            Last_Name: editForm.lastName,
            Middle_Name: editForm.middleName,
            avatar_url: editForm.avatarUrl
          })
          .eq("id", profileData.id)
      ]);

      setProfileData(prev => ({
        ...prev,
        First_Name: editForm.firstName,
        Last_Name: editForm.lastName,
        Middle_Name: editForm.middleName,
        full_name: updatedFullName,
        avatar_url: editForm.avatarUrl
      }));

      setIsEditModalOpen(false);
    } catch (error) {
      alert("Error updating profile: " + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-background w-full min-h-screen flex justify-center items-center">
        <Loader2 className="animate-spin text-foreground" size={40} />
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
    <div className="w-full min-h-screen text-foreground transition-colors">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* PROFILE HEADER CARD */}
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
                authEmail?.charAt(0).toUpperCase() || "?"
              )}
            </div>

            {/* Floating verified check badge on the avatar corner */}
            {profileData?.is_verified_org && (
              <div className="absolute bottom-1 right-1 bg-emerald-600 text-white p-1.5 rounded-full border-2 border-background shadow-md flex items-center justify-center" title="Verified Official Organization">
                <ShieldCheck size={18} />
              </div>
            )}
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center gap-3 mb-3 justify-center md:justify-start flex-wrap">
              <h1 className="text-3xl font-bold text-foreground">{fullName}</h1>

              {/* ROLE BADGE */}
              <span
                className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 border ${isAdmin
                  ? "bg-purple-500/20 text-purple-400 border-purple-500/40"
                  : "bg-blue-500/20 text-blue-400 border-blue-500/40"
                  }`}
              >
                {isAdmin && <ShieldCheck size={14} />}
                {userRole.replace("_", " ")}
              </span>

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

              {/* NEON SOLD BADGE */}
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

              {/* NEON BOUGHT BADGE */}
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
                <Mail size={16} />
                <span>{authEmail}</span>
              </div>
              <div className="hidden md:block w-1.5 h-1.5 bg-neutral-600 rounded-full" />
              <div className="flex items-center gap-2">
                <User size={16} />
                <span>Account active</span>
              </div>
            </div>

            {/* RATINGS & REVIEWS SCORES BAR */}
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

            <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-card hover:bg-neutral-100 dark:hover:bg-neutral-800 text-foreground rounded-xl transition-colors border border-neutral-300 dark:border-neutral-700 font-semibold shadow-sm"
              >
                <Edit size={16} /> Edit Profile
              </button>

              <Link href="/mylistings" className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background hover:opacity-90 rounded-xl transition-all font-semibold shadow-sm">
                <ExternalLink size={16} /> Manage Listings
              </Link>
            </div>
          </div>
        </div>

        {/* MY LISTINGS SECTION */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Package className="text-foreground" /> My Recent Listings
          </h2>
          <Link href="/create-listing" className="text-foreground hover:opacity-70 text-sm font-semibold underline underline-offset-2">
            + Create New Listing
          </Link>
        </div>

        {myProducts.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-800">
            <p className="text-muted-foreground mb-4 font-medium">You haven't listed any products yet.</p>
            <Link href="/create-listing" className="px-6 py-3 bg-foreground text-background rounded-xl font-bold inline-block hover:opacity-90 transition-colors">
              Start Selling
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {myProducts.map((product) => {
              const isPending = product.status === "pending" || (product.tags && product.tags.includes("Pending"));
              const isUnavailable = !product.is_available && !isPending;

              return (
                <div key={product.id} className="relative group transition-all duration-300 hover:-translate-y-1">
                  <Link href={`/products/${product.id}`} className="block">
                    {/* Product card wrapper */}
                    <div className="relative overflow-hidden rounded-2xl">
                      <div className="transition-all duration-300">
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
                      </div>

                      {/* Lighter semi-transparent gray veil overlay (reduced to 25% opacity) */}
                      {(isUnavailable || isPending) && (
                        <div className="absolute inset-0 bg-neutral-900/25 pointer-events-none transition-all" />
                      )}

                      {/* CENTERED BADGES OVERLAY */}
                      {isPending && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                          <span className="text-[10px] bg-amber-500 text-black px-3 py-1.5 rounded-lg font-black uppercase tracking-wider border border-amber-600 shadow-xl">
                            PENDING APPROVAL
                          </span>
                        </div>
                      )}
                      {isUnavailable && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                          <span className="text-[10px] bg-neutral-900 text-neutral-100 px-3 py-1.5 rounded-lg font-black uppercase tracking-wider border border-white/20 shadow-xl">
                            UNAVAILABLE
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* EDIT PROFILE MODAL */}
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-card border border-neutral-300 dark:border-neutral-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-card">
                <h3 className="text-xl font-bold text-foreground">Update Profile</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="text-foreground hover:opacity-70 transition-colors p-1">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="p-8 space-y-6">
                <div className="flex flex-col items-center gap-2">
                  <div className="relative w-24 h-24">
                    <div className="w-24 h-24 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden border border-neutral-300 dark:border-neutral-700 flex items-center justify-center">
                      {editForm.avatarUrl ? (
                        <img src={editForm.avatarUrl} className="w-full h-full object-cover" alt="Preview avatar" />
                      ) : (
                        <User size={36} className="text-muted-foreground" />
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 bg-foreground text-background p-2 rounded-full cursor-pointer hover:opacity-90 shadow-md transition-opacity border border-background">
                      <Camera size={16} />
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUpdating} />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <input
                    placeholder="First Name"
                    className="w-full bg-background border border-neutral-300 dark:border-neutral-700 rounded-xl p-3.5 text-foreground outline-none focus:ring-2 focus:ring-foreground transition-all font-medium placeholder:text-muted-foreground"
                    value={editForm.firstName}
                    onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  />
                  <input
                    placeholder="Middle Name"
                    className="w-full bg-background border border-border rounded-xl p-3.5 text-foreground outline-none focus:ring-2 focus:ring-foreground transition-all font-medium placeholder:text-muted-foreground"
                    value={editForm.middleName}
                    onChange={(e) => setEditForm({ ...editForm, middleName: e.target.value })}
                  />
                  <input
                    placeholder="Last Name"
                    className="w-full bg-background border border-neutral-300 dark:border-neutral-700 rounded-xl p-3.5 text-foreground outline-none focus:ring-2 focus:ring-foreground transition-all font-medium placeholder:text-muted-foreground"
                    value={editForm.lastName}
                    onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3.5 bg-background text-foreground border border-neutral-300 dark:border-neutral-700 rounded-xl font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shadow-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={isUpdating} className="flex-1 py-3.5 bg-foreground text-background rounded-xl font-bold flex items-center justify-center hover:opacity-90 transition-colors disabled:opacity-50 shadow-sm">
                    {isUpdating ? <Loader2 className="animate-spin" size={20} /> : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
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
    </div>
  );
}