"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Package, Edit3, Trash2, Plus, Loader2, AlertTriangle,
  PhilippinePeso, X, Tag, Layers, Hash, FileText, ChevronDown, Clock, RefreshCcw, CreditCard
} from "lucide-react";
import MarkAsTransactedModal from "@/components/MarkAsTransactedModal";

function MyListingsContent() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const dropdownRef = useRef(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const renewParamId = searchParams.get("renew");

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTransactModalOpen, setIsTransactModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);

  // State for GCash payment instructions modal
  const [submittedMerch, setSubmittedMerch] = useState(null);

  const [targetStatus, setTargetStatus] = useState("unavailable");
  const [activeItem, setActiveItem] = useState(null);

  const [editForm, setEditForm] = useState({
    title: "", price: "", description: "", condition: "Good", course_code: "", isRental: false
  });

  const [renewForm, setRenewForm] = useState({
    stock_quantity: "50",
    listing_duration_days: "7"
  });

  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        setCurrentUserId(user.id);
        fetchListings(user.id);
      } else {
        setCurrentUserId(session.user.id);
        fetchListings(session.user.id);
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.push("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (renewParamId && listings.length > 0) {
      const targetListing = listings.find((item) => item.id === renewParamId);
      if (targetListing) {
        setActiveItem(targetListing);
        setIsRenewModalOpen(true);
        setActiveTab("expired");
      }
    }
  }, [renewParamId, listings]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchListings = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select(`*, categories(name)`)
        .eq("seller_id", userId)
        .order("created_at", { ascending: false });

      if (!error) setListings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToPayment = async (e) => {
    e.preventDefault();
    if (!activeItem) return;

    setIsProcessing(true);
    try {
      const daysNum = parseInt(renewForm.listing_duration_days) || 7;
      const calculatedFee = daysNum * 1.00;
      const stockNum = parseInt(renewForm.stock_quantity) || 10;
      const durationStr = `${daysNum} Days`;

      let cleanTags = Array.isArray(activeItem.tags) ? activeItem.tags.filter(t => t !== "Expired") : [];
      if (!cleanTags.includes("Pending")) cleanTags.push("Pending");

      const { error } = await supabase
        .from("products")
        .update({
          created_at: new Date().toISOString(),
          stock_quantity: stockNum,
          listing_duration: durationStr,
          listing_fee: calculatedFee,
          status: "pending",
          is_available: true,
          tags: cleanTags
        })
        .eq("id", activeItem.id);

      if (error) throw error;

      setIsProcessing(false);
      setIsRenewModalOpen(false);

      setSubmittedMerch({
        title: activeItem.title,
        fee: calculatedFee,
        duration: durationStr
      });

    } catch (err) {
      alert("Failed to update renewal data: " + err.message);
      setIsProcessing(false);
    }
  };

  const handleStatusChange = async (item, targetStatusChoice) => {
    setOpenDropdownId(null);

    if (targetStatusChoice === "available") {
      // 🔒 SURGICAL FIX: Block activating items that are still pending admin review or flagged!
      if (item.status === "pending" || item.status === "flagged" || !item.is_published) {
        alert("This listing cannot be made available because it is still awaiting admin approval or has been flagged.");
        return;
      }

      const isMerchandise = item.categories?.name === "Merchandise";
      const createdAt = new Date(item.created_at);
      const durationDays = parseInt(item.listing_duration) || 7;
      const expiryDate = new Date(createdAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
      const isExpired = isMerchandise && new Date() > expiryDate;

      if (isExpired) {
        alert("This merchandise drop has expired. Please use 'Renew Listing' to update stock, duration, and pay the renewal fee.");
        return;
      }

      let updatedTags = Array.isArray(item.tags) ? item.tags.filter(t => t !== "Pending" && t !== "Expired") : [];

      setListings(listings.map(l =>
        l.id === item.id ? { ...l, is_available: true, status: "active", tags: updatedTags } : l
      ));

      await supabase
        .from("products")
        .update({ is_available: true, status: "active", tags: updatedTags })
        .eq("id", item.id);

    } else {
      setActiveItem(item);
      setTargetStatus("unavailable");
      setIsTransactModalOpen(true);
    }
  };

  const openEditModal = (item) => {
    setActiveItem(item);
    setEditForm({
      title: item.title,
      price: item.price,
      description: item.description || "",
      condition: item.condition || "Good",
      course_code: item.course_code || "",
      isRental: item.tags?.includes("Rentals") || false
    });
    setIsEditModalOpen(true);
  };

  const confirmUpdate = async (e) => {
    e.preventDefault();
    if (!activeItem) return;
    setIsProcessing(true);

    try {
      // 1. Prepare form data to re-run AI moderation on the edited content
      const moderationForm = new FormData();
      moderationForm.append("title", editForm.title.trim());
      moderationForm.append("description", editForm.description.trim());

      // If the listing has existing images, fetch the first one as a blob for re-moderation
      if (activeItem.image_urls && activeItem.image_urls.length > 0) {
        try {
          const imgRes = await fetch(activeItem.image_urls[0]);
          const blob = await imgRes.blob();
          moderationForm.append("images", blob, "existing-photo.jpg");
        } catch (imgErr) {
          console.warn("Could not fetch existing image for re-moderation, proceeding with text check:", imgErr);
        }
      }

      // 2. Call your moderation endpoint
      const modRes = await fetch("/api/moderate-listing", {
        method: "POST",
        body: moderationForm,
      });

      if (modRes.status === 401) {
        throw new Error("Your session expired. Please log in again.");
      }

      const moderation = await modRes.json();

      // 3. Block if rejected
      if (moderation.verdict === "rejected") {
        alert(`Listing update blocked: ${moderation.reason || "it violates our posting guidelines."}`);
        setIsProcessing(false);
        return;
      }

      const needsReview = moderation.verdict === "flagged";
      let updatedTags = Array.isArray(activeItem.tags) ? [...activeItem.tags] : [];

      if (editForm.isRental && !updatedTags.includes("Rentals")) updatedTags.push("Rentals");
      if (!editForm.isRental) updatedTags = updatedTags.filter(t => t !== "Rentals");

      // Remove flagged/pending tags if now approved, or add flagged state if needed
      if (needsReview) {
        if (!updatedTags.includes("Flagged")) updatedTags.push("Flagged");
      } else {
        updatedTags = updatedTags.filter(t => t !== "Flagged");
      }

      // 4. Update product payload in Supabase with moderation enforcement
      const updatePayload = {
        title: editForm.title.trim(),
        price: parseFloat(editForm.price),
        description: editForm.description.trim(),
        condition: editForm.condition,
        course_code: editForm.course_code,
        tags: updatedTags,
        is_available: !needsReview && activeItem.is_available,
        status: needsReview ? "flagged" : activeItem.status === "flagged" ? "active" : activeItem.status
      };

      const { error } = await supabase
        .from("products")
        .update(updatePayload)
        .eq("id", activeItem.id);

      if (error) throw error;

      // 5. If flagged during edit, log it and give an unmistakable warning
      if (needsReview) {
        await supabase.from("moderation_flags").insert([
          {
            user_id: currentUserId,
            product_id: activeItem.id,
            image_url: activeItem.image_urls?.[0] || null,
            verdict: "flagged",
            categories: moderation.categories || [],
            reason: moderation.reason || "Flagged during edit update",
          },
        ]);

        alert(
          "⚠️ SAFETY REVIEW REQUIRED\n\nYour recent edits triggered our automated content check. " +
          "Your listing has been automatically set to UNAVAILABLE and sent to the admin queue for manual review. " +
          "It will become active again once approved by a moderator."
        );
      } else {
        alert("Your listing updates were successfully saved and approved!");
      }

      // Update local state smoothly
      setListings(listings.map(item => item.id === activeItem.id ? { ...item, ...updatePayload, price: parseFloat(editForm.price) } : item));
      setIsEditModalOpen(false);
    } catch (err) {
      console.error("Update error:", err);
      alert("Failed to update listing: " + (err.message || "Unknown error"));
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmDelete = async () => {
    if (!activeItem) return;
    setIsProcessing(true);
    const { error } = await supabase.from("products").delete().eq("id", activeItem.id);
    if (!error) {
      setListings(listings.filter(item => item.id !== activeItem.id));
      setIsDeleteModalOpen(false);
    }
    setIsProcessing(false);
  };

  const filteredListings = listings.filter(item => {
    const isPendingAdminReview = item.status === "pending";
    const isMerchandise = item.categories?.name === "Merchandise";
    const createdAt = new Date(item.created_at);
    const durationDays = parseInt(item.listing_duration) || 7;
    const expiryDate = new Date(createdAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const isActuallyExpired = isMerchandise && new Date() > expiryDate;
    const isExpiredTag = item.tags?.includes("Expired") || isActuallyExpired;

    if (activeTab === "expired") return isExpiredTag;
    if (activeTab === "pending") return isPendingAdminReview;
    if (activeTab === "active") return !isPendingAdminReview && !isExpiredTag && item.is_available;
    return true;
  });

  if (loading) return (
    <div className="min-h-screen text-foreground flex flex-col items-center justify-center w-full">
      <Loader2 className="animate-spin text-foreground mb-2" size={32} />
      <p className="text-neutral-500 text-sm font-bold uppercase tracking-widest">Checking Session...</p>
    </div>
  );

  return (
    <div className="text-foreground w-full min-h-screen p-6 md:p-10 transition-colors">
      <div className="max-w-6xl mx-auto">

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black text-foreground tracking-tight uppercase italic">My Listings</h1>
          <Link href="/create-listing" className="bg-foreground text-background px-6 py-3 rounded-xl font-black uppercase tracking-wider text-xs flex items-center gap-2 border border-foreground hover:opacity-95 transition-all active:scale-95 shadow-md">
            <Plus size={16} /> New Listing
          </Link>
        </div>

        <div className="flex items-center gap-2 mb-6 border-b border-neutral-200 dark:border-neutral-800 pb-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === "all" ? "bg-foreground text-background shadow-sm" : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500 hover:text-foreground"}`}
          >
            All Listings ({listings.length})
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${activeTab === "active" ? "bg-foreground text-background shadow-sm" : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500 hover:text-foreground"}`}
          >
            Active
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === "pending" ? "bg-amber-500 text-black shadow-sm font-black" : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500 hover:text-foreground"}`}
          >
            <Clock size={14} /> Pending Payment
          </button>
          <button
            onClick={() => setActiveTab("expired")}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === "expired" ? "bg-red-600 text-white shadow-sm font-black" : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500 hover:text-foreground"}`}
          >
            <AlertTriangle size={14} /> Expired Drops
          </button>
        </div>

        <div className="grid gap-4">
          {filteredListings.length > 0 ? (
            filteredListings.map((item) => {
              const isPendingAdmin = item.status === "pending";
              const isMerchandise = item.categories?.name === "Merchandise";
              const createdAt = new Date(item.created_at);
              const durationDays = parseInt(item.listing_duration) || 7;
              const expiryDate = new Date(createdAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
              const isActuallyExpired = isMerchandise && new Date() > expiryDate;
              const isExpiredTag = item.tags?.includes("Expired") || isActuallyExpired;

              const isUnavailable = !item.is_available || isExpiredTag;

              let cardBgStyles = "bg-neutral-50 dark:bg-neutral-900/60 border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md";
              if (isPendingAdmin) cardBgStyles = "bg-amber-50/40 dark:bg-amber-950/20 border-amber-500/50 shadow-sm";
              else if (isExpiredTag) cardBgStyles = "bg-red-500/10 dark:bg-red-950/30 border-red-500/40";
              else if (isUnavailable) cardBgStyles = "bg-neutral-100/60 dark:bg-neutral-900/30 border-neutral-300 dark:border-neutral-800 opacity-75";

              let currentStatusLabel = "Available";
              let dropdownTriggerStyles = "bg-foreground text-background border-foreground";
              if (isPendingAdmin) {
                currentStatusLabel = "Awaiting Admin";
                dropdownTriggerStyles = "bg-amber-500 text-black border-amber-600";
              } else if (isExpiredTag) {
                currentStatusLabel = "Expired";
                dropdownTriggerStyles = "bg-red-600 text-white border-red-600";
              } else if (isUnavailable) {
                currentStatusLabel = "Unavailable";
                dropdownTriggerStyles = "bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700";
              }

              return (
                <div key={item.id} className={`flex flex-col md:flex-row items-center gap-6 p-4 rounded-2xl border transition-all ${cardBgStyles}`}>

                  <Link href={`/products/${item.id}`} className="shrink-0 relative">
                    <img
                      src={item.image_urls?.[0] || "/placeholder.png"}
                      className={`w-24 h-24 rounded-xl object-cover border border-neutral-200 dark:border-neutral-800 transition-opacity ${isUnavailable ? "grayscale" : "hover:opacity-80"}`}
                      alt={item.title}
                    />
                    {isExpiredTag && (
                      <div className="absolute inset-0 bg-red-600/40 rounded-xl flex items-center justify-center">
                        <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-black uppercase tracking-widest">EXPIRED</span>
                      </div>
                    )}
                  </Link>

                  <div className="flex-grow w-full md:w-auto text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-1.5 flex-wrap">
                      <span className="text-[9px] bg-neutral-200 dark:bg-neutral-800 border text-foreground px-2 py-0.5 rounded font-bold uppercase tracking-widest">{item.categories?.name}</span>
                      {isExpiredTag && <span className="text-[9px] bg-red-100 dark:bg-red-950/60 border border-red-300 text-red-600 px-2 py-0.5 rounded font-bold uppercase tracking-widest">Duration Expired</span>}
                    </div>

                    <Link href={`/products/${item.id}`}>
                      <h3 className={`text-xl font-black uppercase tracking-tight ${isUnavailable && !isExpiredTag ? "text-neutral-500 line-through" : "text-foreground hover:opacity-80"} transition-colors inline-block`}>{item.title}</h3>
                    </Link>

                    <p className="font-bold flex items-center justify-center md:justify-start gap-1 mt-1 text-foreground">
                      <PhilippinePeso size={14} /> {item.price.toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-wrap md:flex-nowrap gap-2 w-full md:w-auto justify-center md:justify-end mt-4 md:mt-0 items-center">
                    {isExpiredTag ? (
                      <button
                        onClick={() => { setActiveItem(item); setIsRenewModalOpen(true); }}
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all"
                      >
                        <RefreshCcw size={14} /> Renew Listing
                      </button>
                    ) : (
                      <div className="relative" ref={openDropdownId === item.id ? dropdownRef : null}>
                        {isPendingAdmin ? (
                          <div className="px-4 py-2.5 bg-amber-500 text-black border border-amber-600 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm min-w-[135px] cursor-not-allowed opacity-90">
                            <span>Awaiting Admin</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setOpenDropdownId(openDropdownId === item.id ? null : item.id)}
                            className={`px-4 py-2.5 border rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-sm min-w-[135px] justify-between ${dropdownTriggerStyles}`}
                          >
                            <span>{currentStatusLabel}</span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${openDropdownId === item.id ? "rotate-180" : ""}`} />
                          </button>
                        )}

                        {!isPendingAdmin && openDropdownId === item.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-background border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl py-1 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                            <button
                              type="button"
                              onClick={() => handleStatusChange(item, "available")}
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors uppercase tracking-wider"
                            >
                              Set Available
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(item, "unavailable")}
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors uppercase tracking-wider"
                            >
                              Mark Unavailable
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <button onClick={() => openEditModal(item)} className="p-2.5 bg-background border border-foreground rounded-xl text-foreground hover:opacity-80 transition-all active:scale-95"><Edit3 size={16} /></button>
                    <button onClick={() => { setActiveItem(item); setIsDeleteModalOpen(true); }} className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-400 dark:border-red-800 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95"><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-24 bg-neutral-50 dark:bg-neutral-900/50 rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-800 animate-in fade-in duration-500">
              <p className="text-neutral-400 text-sm font-bold uppercase tracking-wider">No listings found in this tab.</p>
            </div>
          )}
        </div>
      </div>

      {/* 👉 PROPERLY WIRED MARK AS TRANSACTED MODAL */}
      {isTransactModalOpen && activeItem && (
        <MarkAsTransactedModal
          productId={activeItem.id}
          sellerId={currentUserId}
          isRental={activeItem.tags?.includes("Rentals")}
          targetStatus={targetStatus}
          onClose={() => {
            setIsTransactModalOpen(false);
            setActiveItem(null);
          }}
          onSuccess={async () => {
            setIsTransactModalOpen(false);
            if (currentUserId) {
              await fetchListings(currentUserId);
            }
            setActiveItem(null);
            router.refresh();
          }}
        />
      )}

      {/* RENEW MODAL */}
      {isRenewModalOpen && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-neutral-200 dark:border-neutral-800 w-full max-w-md rounded-3xl shadow-2xl p-6 md:p-8 space-y-6">
            <div className="flex justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-4">
              <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2.5 text-foreground">
                <div className="p-2 bg-red-500/10 text-red-500 rounded-xl">
                  <RefreshCcw size={18} />
                </div>
                Renew Merchandise Drop
              </h3>
              <button onClick={() => setIsRenewModalOpen(false)} className="text-neutral-400 hover:text-foreground"><X size={20} /></button>
            </div>

            <form onSubmit={handleProceedToPayment} className="space-y-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Renewing <strong className="text-foreground">{activeItem.title}</strong> requires updating your stock and specifying your desired duration days (₱1.00 / day fee).
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Layers size={14} className="text-amber-500" /> New Stock Quantity
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl p-3 text-xs font-bold text-foreground outline-none"
                  value={renewForm.stock_quantity}
                  onChange={(e) => setRenewForm({ ...renewForm, stock_quantity: e.target.value })}
                  placeholder="e.g. 50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Clock size={14} className="text-blue-500" /> Listing Duration (Days)
                </label>
                <input
                  required
                  type="number"
                  min="1"
                  className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl p-3 text-xs font-bold text-foreground outline-none"
                  value={renewForm.listing_duration_days}
                  onChange={(e) => setRenewForm({ ...renewForm, listing_duration_days: e.target.value })}
                  placeholder="e.g. 7"
                />
                <p className="text-[10px] text-neutral-400">Calculated Fee: ₱{(parseInt(renewForm.listing_duration_days || 0) * 1.00).toFixed(2)}</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRenewModalOpen(false)}
                  className="flex-1 py-3 bg-neutral-200 dark:bg-neutral-800 text-foreground rounded-2xl text-xs font-black uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={16} /> : "Proceed to Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GCASH PAYMENT INSTRUCTIONS MODAL WORKFLOW */}
      {submittedMerch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl space-y-6">

            <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-4">
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
                <CreditCard size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Payment Required</h3>
                <p className="text-xs text-neutral-500">Merchandise Drop Verification</p>
              </div>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-1 text-xs">
              <p className="font-bold text-amber-700 dark:text-amber-400">Total Listing Fee to Settle:</p>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-300">₱{submittedMerch.fee.toFixed(2)}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                ({submittedMerch.duration} duration fee)
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <p className="font-bold uppercase text-neutral-400 tracking-wider">Payment Instructions:</p>

              <div className="p-3 bg-neutral-100 dark:bg-neutral-900 rounded-xl space-y-1 border border-neutral-200 dark:border-neutral-800">
                <p className="font-bold text-foreground">GCash Account:</p>
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">0912 345 6789</p>
                <p className="text-[11px] text-neutral-500">Account Name: OLFU Marketplace Admin</p>
              </div>

              <div className="space-y-1.5 text-neutral-600 dark:text-neutral-300">
                <p className="font-bold text-foreground">Steps after paying:</p>
                <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                  <li>Take a screenshot of your GCash payment receipt.</li>
                  <li>Send an email to <strong className="text-foreground">olfumarketplace@gmail.com</strong>.</li>
                  <li>Include your item title (<span className="italic">"{submittedMerch.title}"</span>) and attach the receipt screenshot.</li>
                </ol>
              </div>
            </div>

            <button
              onClick={() => {
                setSubmittedMerch(null);
                if (currentUserId) fetchListings(currentUserId);
                router.push("/mylistings");
                router.refresh();
              }}
              className="w-full py-4 bg-foreground text-background font-black uppercase tracking-wider text-xs rounded-2xl hover:opacity-90 transition-all"
            >
              I Understand, Go to My Listings
            </button>

          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-neutral-200 dark:border-neutral-800 w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <form onSubmit={confirmUpdate} className="flex flex-col h-full">
              <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center bg-neutral-50/50 dark:bg-neutral-900/50">
                <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2 text-foreground"><Edit3 size={18} /> Edit Listing</h3>
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="text-neutral-400 hover:text-foreground transition-colors"><X size={22} /></button>
              </div>

              <div className="p-8 space-y-5 overflow-y-auto">
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                  <input required className="w-full bg-background border border-neutral-300 dark:border-neutral-700 rounded-xl p-3.5 pl-12 text-foreground outline-none focus:ring-2 focus:ring-foreground text-xs font-semibold placeholder:text-neutral-400"
                    value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Title" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-xs">₱</span>
                    <input required type="number" className="w-full bg-background border border-neutral-300 dark:border-neutral-700 rounded-xl p-3.5 pl-9 text-foreground outline-none focus:ring-2 focus:ring-foreground text-xs font-semibold placeholder:text-neutral-400"
                      value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} placeholder="Price" />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex gap-3 bg-neutral-50/50 dark:bg-neutral-900/50">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 bg-neutral-200 dark:bg-neutral-800 text-foreground text-xs font-black uppercase tracking-wider rounded-xl">Cancel</button>
                <button type="submit" disabled={isProcessing} className="flex-1 py-3 bg-foreground text-background text-xs font-black uppercase tracking-wider rounded-xl">
                  {isProcessing ? <Loader2 className="animate-spin mx-auto" size={16} /> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-neutral-200 dark:border-neutral-800 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
            <div className="bg-red-50 dark:bg-red-950/40 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h3 className="text-xl font-black uppercase tracking-tight mb-2 text-foreground">Delete Listing?</h3>
            <p className="text-neutral-500 dark:text-neutral-400 mb-6 text-xs font-medium leading-relaxed">This action cannot be undone.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-3 bg-neutral-200 dark:bg-neutral-800 text-foreground text-xs font-black uppercase tracking-wider rounded-xl">Cancel</button>
              <button onClick={confirmDelete} disabled={isProcessing} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider rounded-xl">
                {isProcessing ? <Loader2 className="animate-spin mx-auto" size={16} /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyListings() {
  return (
    <Suspense fallback={
      <div className="min-h-screen text-foreground flex flex-col items-center justify-center w-full">
        <Loader2 className="animate-spin text-foreground mb-2" size={32} />
        <p className="text-neutral-500 text-sm font-bold uppercase tracking-widest">Loading Listings...</p>
      </div>
    }>
      <MyListingsContent />
    </Suspense>
  );
}