"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import SellerControls from "@/components/SellerControls";
import MakeOffer from "@/components/MakeOffer";
import RequestToBorrow from "@/components/RequestToBorrow";
import SendMessageToSeller from "@/components/SendMessageToSeller";
import { Mail, Loader2, Building2, MessageSquare, ShieldCheck } from "lucide-react";
import { getListingState } from "@/lib/listingStatus";

export default function ProductActions({
  product,
  profile,
  sellerName,
  isVerifiedOrg = false,
  orgName = null,
}) {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderQty, setOrderQty] = useState(1);
  const [inquiring, setInquiring] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
      setLoading(false);
    };
    checkUser();
  }, []);

  if (loading) {
    return (
      <div className="py-6 flex justify-center text-muted-foreground">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  const isOwner = currentUserId && currentUserId === product.seller_id;

  if (isOwner) {
    return <SellerControls product={product} currentUserId={currentUserId} />;
  }

  const isMerchandise = product.categories?.name === "Merchandise";
  const stockAvailable = product.stock_quantity ?? 1;
  const listingState = getListingState(product);
  const canBuy = listingState === "active";

  // 👉 Handle Merchandise Inquiry & Messaging Flow
  const handleInquireMerchandise = async () => {
    if (!currentUserId) {
      alert("Please log in to purchase merchandise.");
      router.push("/login");
      return;
    }

    if (orderQty > stockAvailable) {
      alert(`Only ${stockAvailable} units left in stock!`);
      return;
    }

    setInquiring(true);

    try {
      const messageText = encodeURIComponent(
        `Hi! I would like to order ${orderQty} unit(s) of "${product.title}" (Total: ₱${(product.price * orderQty).toLocaleString()}). Here is my GCash payment screenshot reference.`
      );

      router.push(`/chat?seller=${product.seller_id}&product=${product.id}&qty=${orderQty}&message=${messageText}`);
    } catch (err) {
      alert("Failed to open chat: " + err.message);
      setInquiring(false);
    }
  };

  const isRentalOrBorrow = product.tags?.some((tag) =>
    ["Rentals", "Rental", "Borrow", "For Borrow"].includes(tag)
  );

  return (
    <div className="space-y-6">
      {/* Logged-out visitors can browse but not contact the seller */}
      {canBuy && !currentUserId ? (
        <div className="pt-4 border-t border-border">
          <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3 text-center">
            <p className="text-xs font-bold text-muted-foreground">
              Log in to message the seller or make an offer.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-5 py-2.5 bg-foreground text-background font-bold rounded-xl hover:opacity-90 transition-opacity text-xs"
            >
              Log in
            </Link>
          </div>
        </div>
      ) : canBuy ? (
        <div className="space-y-4 pt-4 border-t border-border">

          {/* 👉 MERCHANDISE QUANTITY & MESSAGING / INQUIRY FLOW */}
          {isMerchandise ? (
            <div className="p-4 bg-muted/40 border border-border rounded-2xl space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-foreground">
                <span>Select Quantity:</span>
                <span className="text-emerald-600 dark:text-emerald-400">{stockAvailable} Units Available</span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  max={stockAvailable}
                  value={orderQty}
                  onChange={(e) => setOrderQty(Math.min(parseInt(e.target.value) || 1, stockAvailable))}
                  className="w-24 bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none"
                />
                <button
                  onClick={handleInquireMerchandise}
                  disabled={inquiring || stockAvailable <= 0}
                  className="flex-1 py-3 bg-foreground text-background hover:opacity-90 text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {inquiring ? (
                    <><Loader2 className="animate-spin" size={16} /> Opening Chat...</>
                  ) : stockAvailable <= 0 ? (
                    "Sold Out"
                  ) : (
                    <><MessageSquare size={16} /> Order & Message Org (₱{(product.price * orderQty).toLocaleString()})</>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                Clicking this opens a chat with the organization to send your GCash receipt.
              </p>
            </div>
          ) : (
            <MakeOffer sellerId={product.seller_id} productTitle={product.title} productId={product.id} />
          )}

          {/* ONLY SHOWN FOR RENTAL/BORROW ITEMS */}
          {isRentalOrBorrow && !isMerchandise && (
            <RequestToBorrow sellerId={product.seller_id} productTitle={product.title} productId={product.id} />
          )}
        </div>
      ) : (
        <div className="pt-4 border-t border-border">
          <div className="p-4 rounded-2xl bg-muted/40 border border-border text-xs font-bold text-muted-foreground">
            {listingState === "expired"
              ? "This listing has expired."
              : "This listing is no longer available."}
          </div>
        </div>
      )}

      {/* Seller Info & Contact Form */}
      <div className="pt-6 border-t border-border">
        {/* Clickable Seller Profile Link */}
        <Link
          href={`/profile/${product.seller_id}`}
          className="flex items-center gap-3 mb-6 group hover:opacity-80 transition-opacity w-fit"
        >
          {/* 👉 AVATAR WITH CONDITIONAL VERIFIED ORG GLOW & CHECKMARK BADGE */}
          <div className="relative shrink-0">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold overflow-hidden shadow-md transition-all ${isVerifiedOrg
              ? "border-2 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)] bg-emerald-600 text-white"
              : "border-2 border-neutral-300 dark:border-neutral-700 bg-muted text-foreground"
              }`}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Seller Avatar" className="w-full h-full object-cover" />
              ) : (
                sellerName?.charAt(0).toUpperCase()
              )}
            </div>

            {/* Floating Checkmark Badge */}
            {isVerifiedOrg && (
              <div className="absolute -bottom-0.5 -right-0.5 bg-emerald-600 text-white p-0.5 rounded-full border-2 border-background shadow-sm flex items-center justify-center" title="Verified Official Organization">
                <ShieldCheck size={11} />
              </div>
            )}
          </div>

          <div>
            <div className="text-sm font-bold text-foreground group-hover:underline flex items-center gap-2 flex-wrap">
              <span>{sellerName}</span>

              {/* VERIFIED ORG BADGE */}
              {isVerifiedOrg && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-md text-[11px] font-bold no-underline">
                  <Building2 size={12} />
                  <span>{orgName || "Verified Org"}</span>
                </span>
              )}
            </div>

          </div>
        </Link>

        {currentUserId && (
          <SendMessageToSeller sellerId={product.seller_id} productId={product.id} />
        )}
      </div>
    </div>
  );
}