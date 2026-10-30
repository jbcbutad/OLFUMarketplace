"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Package, Edit3, Trash2, Plus, Loader2, AlertTriangle,
  PhilippinePeso, X, Tag, Layers, Hash, FileText, ChevronDown, Clock, RefreshCcw, CreditCard,
  Send, XCircle
} from "lucide-react";
import MarkAsTransactedModal from "@/components/MarkAsTransactedModal";
import RelistButton from "@/components/RelistButton";
import EditListingModal from "@/components/EditListingModal";
import { isMerch } from "@/lib/merch";
import { getListingState } from "@/lib/listingStatus";

// Shared tab styles (smaller on mobile so the tabs wrap neatly)
const TAB_BASE =
  "px-3 py-2 md:px-4 rounded-xl text-[11px] md:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap";
const TAB_OFF = "bg-neutral-100 dark:bg-neutral-900 text-neutral-500 hover:text-foreground";
const MAX_STOCK = 999;
const MAX_DAYS = 365;


function MyListingsContent() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resubmittingId, setResubmittingId] = useState(null);
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

  const [submittedMerch, setSubmittedMerch] = useState(null);

  const [targetStatus, setTargetStatus] = useState("unavailable");
  const [activeItem, setActiveItem] = useState(null);

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
      const daysNum = parseInt(renewForm.listing_duration_days, 10);
      const stockNum = parseInt(renewForm.stock_quantity, 10);
      if (!Number.isInteger(daysNum) || daysNum < 1 || daysNum > MAX_DAYS) {
        toast.error(`Duration must be between 1 and ${MAX_DAYS} days.`);
        setIsProcessing(false);
        return;
      }
      if (!Number.isInteger(stockNum) || stockNum < 1 || stockNum > MAX_STOCK) {
        toast.error(`Stock must be between 1 and ${MAX_STOCK}.`);
        setIsProcessing(false);
        return;
      }


      const { data: fee, error } = await supabase.rpc("request_merch_renewal", {
        p_product_id: activeItem.id,
        p_stock: stockNum,
        p_days: daysNum,
      });
      if (error) throw error;

      setIsProcessing(false);
      setIsRenewModalOpen(false);

      setSubmittedMerch({
        title: activeItem.title,
        fee: Number(fee),
        duration: `${daysNum} Days`,
      });

    } catch (err) {
      toast.error("Failed to update renewal data: " + err.message);
      setIsProcessing(false);
    }
  };

  // Send a rejected listing back to the admin review queue
  const handleResubmit = async (item) => {
    setResubmittingId(item.id);
    const { data: newStatus, error } = await supabase.rpc("resubmit_listing", {
      p_product_id: item.id,
    });
    setResubmittingId(null);

    if (error) {
      toast.error("Couldn't resubmit: " + error.message, { duration: 7000 });
      return;
    }

    // Merch drops go back to "pending" (payment review).
    // Regular listings go back to "flagged" (moderator review).
    const nextStatus = newStatus === "flagged" ? "flagged" : "pending";
    setListings((prev) =>
      prev.map((l) => (l.id === item.id ? { ...l, status: nextStatus, is_available: false } : l))
    );
    setActiveTab(nextStatus);
    toast.success(
      nextStatus === "pending"
        ? "Resubmitted. Your drop is back in the payment review queue."
        : "Resubmitted. A moderator will review your listing again."
    );
  };

  const handleStatusChange = async (item, targetStatusChoice) => {
    setOpenDropdownId(null);

    if (targetStatusChoice === "available") {
      if (item.status === "pending" || item.status === "flagged" || !item.is_published) {
        toast.error("This listing cannot be made available because it is still awaiting admin approval or has been flagged.");
        return;
      }

      const isMerchandise = isMerch(item);

      if (item.status === "rejected") {
        toast.error("This listing was rejected by an admin. Use 'Resubmit' to send it for review again.");
        return;
      }

      if (getListingState(item) === "expired") {
        toast.error(
          isMerchandise
            ? "This merchandise drop has expired. Please use 'Renew Listing' to update stock, duration, and pay the renewal fee."
            : "This listing has expired. Use 'Relist' to put it back up.",
          { duration: 8000 }
        );
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
      // PREVENT REDUNDANT CLICKS: If already unavailable and not available, don't re-trigger
      if (!item.is_available && item.status === "unavailable") {
        return;
      }

      setActiveItem(item);
      setTargetStatus("unavailable");
      setIsTransactModalOpen(true);
    }
  };

  const confirmDelete = async () => {
    if (!activeItem) return;
    setIsProcessing(true);
    const { data, error } = await supabase
      .from("products")
      .delete()
      .eq("id", activeItem.id)
      .select("id");
    setIsProcessing(false);

    if (error) {
      toast.error("Couldn't delete: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      toast.error("Couldn't delete this listing. You may not have permission.");
      return;
    }

    setListings(listings.filter((item) => item.id !== activeItem.id));
    setIsDeleteModalOpen(false);
    setActiveItem(null);
    toast.success("Listing deleted.");
  };

  const filteredListings = listings.filter(item => {
    const isPendingAdminReview = item.status === "pending";
    const isFlagged = item.status === "flagged";
    const isRejected = item.status === "rejected";
    const isExpiredTag = getListingState(item) === "expired";

    if (activeTab === "expired") return isExpiredTag && !isRejected;
    if (activeTab === "pending") return isPendingAdminReview;
    if (activeTab === "flagged") return isFlagged;
    if (activeTab === "rejected") return isRejected;
    if (activeTab === "active") return !isPendingAdminReview && !isFlagged && !isRejected && !isExpiredTag && item.is_available;
    return true;
  });

  if (loading) return (
    <div className="min-h-screen text-foreground flex flex-col items-center justify-center w-full">
      <Loader2 className="animate-spin text-foreground mb-2" size={32} />
      <p className="text-neutral-500 text-sm font-bold uppercase tracking-widest">Checking Session...</p>
    </div>
  );

  return (
    // pb-28 keeps the last card clear of the fixed Superadmin footer on mobile
    <div className="text-foreground w-full min-h-screen px-3 pt-4 pb-28 sm:p-6 md:p-10 transition-colors overflow-x-hidden">
      <div className="max-w-6xl mx-auto">

        <div className="flex justify-between items-center gap-3 mb-5 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tight uppercase italic">My Listings</h1>
          <Link href="/create-listing" className="shrink-0 bg-foreground text-background px-4 py-2.5 md:px-6 md:py-3 rounded-xl font-black uppercase tracking-wider text-xs flex items-center gap-1.5 md:gap-2 border border-foreground hover:opacity-95 transition-all active:scale-95 shadow-md">
            <Plus size={16} /> New Listing
          </Link>
        </div>

        {/* Navigation Tabs (wrap onto rows on mobile so every tab is visible) */}
        <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-5 md:mb-6 border-b border-neutral-900 dark:border-neutral-200 pb-3 md:pb-4">
          <button
            onClick={() => setActiveTab("all")}
            className={`${TAB_BASE} ${activeTab === "all" ? "bg-foreground text-background shadow-sm" : TAB_OFF}`}
          >
            All Listings ({listings.length})
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={`${TAB_BASE} ${activeTab === "active" ? "bg-foreground text-background shadow-sm" : TAB_OFF}`}
          >
            Active
          </button>
          <button
            onClick={() => setActiveTab("flagged")}
            className={`${TAB_BASE} flex items-center gap-1.5 ${activeTab === "flagged" ? "bg-rose-600 text-white shadow-sm font-black" : TAB_OFF}`}
          >
            <AlertTriangle size={14} /> Flagged
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`${TAB_BASE} flex items-center gap-1.5 ${activeTab === "pending" ? "bg-amber-500 text-black shadow-sm font-black" : TAB_OFF}`}
          >
            <Clock size={14} /> Pending Payment
          </button>
          <button
            onClick={() => setActiveTab("rejected")}
            className={`${TAB_BASE} flex items-center gap-1.5 ${activeTab === "rejected" ? "bg-red-600 text-white shadow-sm font-black" : TAB_OFF}`}
          >
            <XCircle size={14} /> Rejected
          </button>
          <button
            onClick={() => setActiveTab("expired")}
            className={`${TAB_BASE} flex items-center gap-1.5 ${activeTab === "expired" ? "bg-red-600 text-white shadow-sm font-black" : TAB_OFF}`}
          >
            <AlertTriangle size={14} /> Expired
          </button>
        </div>

        <div className="grid gap-3 md:gap-4">
          {filteredListings.length > 0 ? (
            filteredListings.map((item) => {
              const isPendingAdmin = item.status === "pending";
              const isFlagged = item.status === "flagged";
              const isRejected = item.status === "rejected";
              const isMerchandise = isMerch(item);
              const isExpiredTag = getListingState(item) === "expired";

              // Pending and flagged listings cannot be edited.
              // Rejected ones can, so the seller can fix them before resubmitting.
              const editLocked = isPendingAdmin || isFlagged;

              const isUnavailable = !item.is_available || isExpiredTag;

              const msLeft = item.expires_at ? new Date(item.expires_at).getTime() - Date.now() : null;
              const nearExpiry =
                !isMerchandise && item.status === "active" && item.is_available &&
                msLeft !== null && msLeft > 0 && msLeft <= 3 * 24 * 60 * 60 * 1000;

              let cardBgStyles = "bg-neutral-50 dark:bg-neutral-900 border-neutral-900 dark:border-white shadow-sm hover:shadow-md";
              if (isFlagged) cardBgStyles = "bg-neutral-100/60 dark:bg-neutral-900/30 border-neutral-900 dark:border-white opacity-75";
              else if (isPendingAdmin) cardBgStyles = "bg-amber-50/40 dark:bg-amber-950/20 border-neutral-900 dark:border-white shadow-sm";
              else if (isRejected) cardBgStyles = "bg-red-500/5 dark:bg-red-950/20 border-red-500/40";
              else if (isExpiredTag) cardBgStyles = "bg-red-500/10 dark:bg-red-950/30 border-red-500/40";
              // No card-level opacity here: it would also fade the status dropdown and trap it under the next card.
              else if (isUnavailable) cardBgStyles = "bg-neutral-100 dark:bg-neutral-900/60 border-neutral-900 dark:border-white";

              let currentStatusLabel = "Available";
              let dropdownTriggerStyles = "bg-foreground text-background border-neutral-900 dark:border-white";
              if (isFlagged) {
                currentStatusLabel = "Flagged";
                dropdownTriggerStyles = "bg-rose-600 text-white border-neutral-900 dark:border-white";
              } else if (isPendingAdmin) {
                currentStatusLabel = "Awaiting Admin";
                dropdownTriggerStyles = "bg-amber-500 text-black border-neutral-900 dark:border-white";
              } else if (isExpiredTag) {
                currentStatusLabel = "Expired";
                dropdownTriggerStyles = "bg-red-600 text-white border-red-600";
              } else if (isUnavailable) {
                currentStatusLabel = "Unavailable";
                dropdownTriggerStyles = "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white border-neutral-900 dark:border-white";
              }

              return (
                <div
                  key={item.id}
                  className={`flex flex-col gap-3 p-3 md:p-4 rounded-2xl border transition-all ${cardBgStyles} ${openDropdownId === item.id ? "relative z-20" : ""}`}
                >

                  {/* FLAGGED BANNER NOTICE ON LISTING ROW IF FLAGGED */}
                  {isFlagged && (
                    <div className="bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 px-3 py-2 rounded-xl flex items-start gap-2 text-rose-600 dark:text-rose-400 text-xs font-bold">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-500" />
                      <span><strong className="text-rose-600 dark:text-rose-400">Under Safety Review (Flagged):</strong> This listing has triggered moderation checks and is hidden from the marketplace.</span>
                    </div>
                  )}

                  {/* REJECTED BANNER */}
                  {isRejected && (
                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-800 px-3 py-2 rounded-xl flex items-start gap-2 text-red-600 dark:text-red-400 text-xs font-bold">
                      <XCircle size={15} className="shrink-0 mt-0.5" />
                      <span>
                        <strong>Rejected by admin:</strong> Edit your listing if needed, then resubmit it for review.
                      </span>
                    </div>
                  )}

                  {/* PAYMENT DUE NOTICE FOR PENDING MERCH */}
                  {isPendingAdmin && isMerchandise && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5 text-xs space-y-0.5">
                      <p className="font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                        Payment needed: ₱{Number(item.listing_fee || 0).toFixed(2)}
                        {item.listing_duration ? ` (${item.listing_duration})` : ""}
                      </p>
                      <p className="text-neutral-600 dark:text-neutral-300">
                        Send to GCash <strong>09277549105</strong>, then email the receipt and the item title
                        to <strong>olfumarketplace@gmail.com</strong>. An admin approves the drop once it is verified.
                      </p>
                    </div>
                  )}

                  {/* Mobile: image + info side by side, buttons on the next row. Desktop: one row. */}
                  <div className="flex flex-wrap md:flex-nowrap items-center gap-3 md:gap-6">
                    <Link href={`/products/${item.id}`} className="shrink-0 relative">
                      <img
                        src={item.image_urls?.[0] || "/placeholder.png"}
                        className={`w-20 h-20 md:w-24 md:h-24 rounded-xl object-cover border border-neutral-200 dark:border-neutral-800 transition-opacity ${isUnavailable ? "grayscale opacity-60" : "hover:opacity-80"}`}
                        alt={item.title}
                      />
                      {isFlagged && (
                        <div className="absolute inset-0 bg-rose-600/40 rounded-xl flex items-center justify-center">
                          <span className="text-[9px] bg-rose-600 text-white px-2 py-0.5 rounded font-black uppercase tracking-widest">FLAGGED</span>
                        </div>
                      )}
                      {isExpiredTag && !isFlagged && (
                        <div className="absolute inset-0 bg-red-600/40 rounded-xl flex items-center justify-center">
                          <span className="text-[10px] bg-red-600 text-white px-2 py-0.5 rounded font-black uppercase tracking-widest">EXPIRED</span>
                        </div>
                      )}
                    </Link>

                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-start gap-1.5 md:gap-2 mb-1.5 flex-wrap">
                        <span className="text-[9px] bg-neutral-200 dark:bg-neutral-800 border text-foreground px-2 py-0.5 rounded font-bold uppercase tracking-widest">{item.categories?.name}</span>
                        {isFlagged && <span className="text-[9px] bg-rose-100 dark:bg-rose-950/60 border border-rose-300 text-rose-600 px-2 py-0.5 rounded font-bold uppercase tracking-widest">Safety Flag</span>}
                        {isRejected && <span className="text-[9px] bg-red-100 dark:bg-red-950/60 border border-red-300 text-red-600 px-2 py-0.5 rounded font-bold uppercase tracking-widest">Rejected</span>}
                        {isExpiredTag && <span className="text-[9px] bg-red-100 dark:bg-red-950/60 border border-red-300 text-red-600 px-2 py-0.5 rounded font-bold uppercase tracking-widest">{isMerchandise ? "Duration Expired" : "Listing Expired"}</span>}
                      </div>

                      <Link href={`/products/${item.id}`}>
                        <h3 className={`text-base md:text-xl font-black uppercase tracking-tight break-words ${isUnavailable && !isExpiredTag && !isFlagged && !isRejected ? "text-neutral-500 line-through" : "text-foreground hover:opacity-80"} transition-colors inline-block`}>{item.title}</h3>
                      </Link>

                      <p className="font-bold flex items-center justify-start gap-1 mt-1 text-foreground">
                        <PhilippinePeso size={14} /> {item.price.toLocaleString()}
                      </p>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto basis-full md:basis-auto justify-center md:justify-end items-center">
                      {nearExpiry && (
                        <RelistButton
                          productId={item.id}
                          label="Renew (Free)"
                          onDone={() => fetchListings(currentUserId)}
                          className="flex-1 md:flex-none px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-black rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all"
                        />
                      )}
                      {isRejected ? (
                        <button
                          type="button"
                          onClick={() => handleResubmit(item)}
                          disabled={resubmittingId === item.id}
                          className="flex-1 md:flex-none justify-center px-4 py-2.5 bg-foreground text-background rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
                        >
                          {resubmittingId === item.id
                            ? <Loader2 className="animate-spin" size={14} />
                            : <><Send size={14} /> Resubmit</>}
                        </button>
                      ) : isExpiredTag ? (
                        isMerchandise ? (
                          <button
                            onClick={() => { setActiveItem(item); setIsRenewModalOpen(true); }}
                            className="flex-1 md:flex-none justify-center px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all"
                          >
                            <RefreshCcw size={14} /> Renew Listing
                          </button>
                        ) : (
                          <RelistButton
                            productId={item.id}
                            label="Relist (Free)"
                            onDone={() => fetchListings(currentUserId)}
                            className="flex-1 md:flex-none px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all"
                          />
                        )
                      ) : (
                        <div className="relative flex-1 md:flex-none" ref={openDropdownId === item.id ? dropdownRef : null}>
                          {isPendingAdmin ? (
                            <div className="px-4 py-2.5 bg-amber-500 text-black border border-amber-600 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm md:min-w-[135px] cursor-not-allowed opacity-90">
                              <span>Awaiting Admin</span>
                            </div>
                          ) : isFlagged ? (
                            <div className="px-4 py-2.5 bg-rose-600 text-white border border-rose-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm md:min-w-[135px] cursor-not-allowed">
                              <span>Flagged</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setOpenDropdownId(openDropdownId === item.id ? null : item.id)}
                              className={`w-full px-4 py-2.5 border rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-sm md:min-w-[135px] justify-between ${dropdownTriggerStyles}`}
                            >
                              <span>{currentStatusLabel}</span>
                              <ChevronDown size={14} className={`transition-transform duration-200 ${openDropdownId === item.id ? "rotate-180" : ""}`} />
                            </button>
                          )}

                          {!isPendingAdmin && !isFlagged && openDropdownId === item.id && (
                            <div className="absolute left-0 md:left-auto md:right-0 mt-2 w-48 bg-background border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl py-1 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
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

                      {/* EDIT: disabled for pending / flagged. Rejected listings can be edited. */}
                      <button
                        type="button"
                        onClick={() => {
                          if (editLocked) return;
                          setActiveItem(item);
                          setIsEditModalOpen(true);
                        }}
                        disabled={editLocked}
                        aria-label="Edit listing"
                        title={editLocked ? "Listings that are pending or flagged can't be edited" : "Edit listing"}
                        className={`shrink-0 p-2.5 bg-background border border-foreground rounded-xl text-foreground transition-all ${editLocked ? "opacity-40 cursor-not-allowed" : "hover:opacity-80 active:scale-95"}`}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        aria-label="Delete listing"
                        onClick={() => { setActiveItem(item); setIsDeleteModalOpen(true); }}
                        className="shrink-0 p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-400 dark:border-red-800 rounded-xl text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-16 md:py-24 px-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-800 animate-in fade-in duration-500">
              <p className="text-neutral-400 text-sm font-bold uppercase tracking-wider">No listings found in this tab.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
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

      {isRenewModalOpen && activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-neutral-200 dark:border-neutral-800 w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-3xl shadow-2xl p-5 md:p-8 space-y-5 md:space-y-6">
            <div className="flex justify-between items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-4">
              <h3 className="text-base md:text-lg font-black uppercase tracking-tight flex items-center gap-2.5 text-foreground">
                <div className="p-2 bg-red-500/10 text-red-500 rounded-xl shrink-0">
                  <RefreshCcw size={18} />
                </div>
                Renew Merchandise Drop
              </h3>
              <button onClick={() => setIsRenewModalOpen(false)} aria-label="Close" className="shrink-0 text-neutral-400 hover:text-foreground"><X size={20} /></button>
            </div>

            <form onSubmit={handleProceedToPayment} className="space-y-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Renewing <strong className="text-foreground">{activeItem.title}</strong> requires updating your stock and specifying your desired duration days (₱1.00 / day fee).
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Layers size={14} className="text-amber-500" /> New Stock Quantity
                </label>
                {/* text-base on mobile stops iOS from zooming in on focus */}
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl p-3 text-base md:text-xs font-bold text-foreground outline-none"
                  value={renewForm.stock_quantity}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setRenewForm({
                      ...renewForm,
                      stock_quantity: digits === "" ? "" : String(Math.min(Number(digits), MAX_STOCK)),
                    });
                  }}
                  placeholder="e.g. 50 (max 999)"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1">
                  <Clock size={14} className="text-blue-500" /> Listing Duration (Days)
                </label>
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-xl p-3 text-base md:text-xs font-bold text-foreground outline-none"
                  value={renewForm.listing_duration_days}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setRenewForm({
                      ...renewForm,
                      listing_duration_days: digits === "" ? "" : String(Math.min(Number(digits), MAX_DAYS)),
                    });
                  }}
                  placeholder={`e.g. 7 (max ${MAX_DAYS})`}
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

      {submittedMerch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-neutral-200 dark:border-neutral-800 p-5 md:p-8 rounded-3xl max-w-md w-full max-h-[90dvh] overflow-y-auto shadow-2xl space-y-5 md:space-y-6">

            <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-4">
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl shrink-0">
                <CreditCard size={24} />
              </div>
              <div className="min-w-0">
                <h3 className="text-base md:text-lg font-black uppercase tracking-tight text-foreground">Payment Required</h3>
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
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">09277549105</p>
                <p className="text-[11px] text-neutral-500">OLFU Marketplace Admin</p>
              </div>

              <div className="space-y-1.5 text-neutral-600 dark:text-neutral-300">
                <p className="font-bold text-foreground">Steps after paying:</p>
                <ol className="list-decimal pl-4 space-y-1 text-[11px] break-words">
                  <li>Take a screenshot of your GCash payment receipt.</li>
                  <li>Send an email to <strong className="text-foreground break-all">olfumarketplace@gmail.com</strong>.</li>
                  <li>Include your item title (<span className="italic">&quot;{submittedMerch.title}&quot;</span>) and attach the receipt screenshot.</li>
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

      {isEditModalOpen && activeItem && (
        <EditListingModal
          product={activeItem}
          onClose={() => { setIsEditModalOpen(false); setActiveItem(null); }}
          onSaved={(changes) => {
            setListings((prev) => prev.map((l) => (l.id === activeItem.id ? { ...l, ...changes } : l)));
            setIsEditModalOpen(false);
            setActiveItem(null);
          }}
        />
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-background border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl">
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