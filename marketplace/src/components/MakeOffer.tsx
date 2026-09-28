"use client";

import { useState, useEffect } from "react";
import { Handshake, PhilippinePeso, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function MakeOffer({ 
  sellerId, 
  productTitle 
}: { 
  sellerId: string; 
  productTitle: string; 
}) {
  const [offerAmount, setOfferAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingOwner, setCheckingOwner] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function checkOwnership() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id === sellerId) {
        setIsOwner(true);
      }
      setCheckingOwner(false);
    }
    checkOwnership();
  }, [sellerId]);

  async function handleOffer() {
    if (!offerAmount || Number(offerAmount) <= 0 || loading || isOwner) return;
    if (!sellerId) {
      alert("Seller information is missing.");
      return;
    }

    setLoading(true);

    try {
      // 1. Get or create the chat room via Supabase RPC
      const { data: roomId, error: roomError } = await supabase.rpc("get_or_create_direct_room", {
        p_other_user: sellerId,
      });

      if (roomError || !roomId) {
        throw new Error(roomError?.message || "Failed to set up chat room.");
      }

      // 2. Format offer payload message
      const offerMessage = `💰 I'd like to make an offer of ₱${Number(offerAmount).toLocaleString("en-PH", { minimumFractionDigits: 2 })} for your "${productTitle}".`;

      // 3. Post to API route
      const msgRes = await fetch("/api/direct-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          roomId, 
          body: offerMessage, 
          image_url: null 
        }),
      });

      const msgData = await msgRes.json().catch(() => ({}));
      if (!msgRes.ok) throw new Error(msgData.error || "Failed to transmit message.");

      // 4. Redirect to room
      router.push(`/chat/${roomId}?sellerId=${sellerId}`);
      router.refresh();
    } catch (err: any) {
      alert("Error sending offer: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (checkingOwner) {
    return (
      <div className="w-full flex justify-center py-3">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isOwner) return null; // Hide offer container entirely for own listing

  return (
    <div className="space-y-2.5">
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Offer a Price (₱)
      </label>
      <div className="flex items-center gap-3">
        <div className="relative grow">
          <PhilippinePeso className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input 
            type="number" 
            min="1"
            value={offerAmount}
            onChange={(e) => setOfferAmount(e.target.value)}
            placeholder="0.00" 
            disabled={loading}
            className="w-full bg-muted border border-border text-foreground rounded-xl py-2.5 pl-9 pr-4 text-sm font-semibold focus:ring-2 focus:ring-foreground/20 outline-none transition-all placeholder:text-muted-foreground/60 disabled:opacity-50"
          />
        </div>
        <button 
          onClick={handleOffer}
          disabled={!offerAmount || Number(offerAmount) <= 0 || loading}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl transition-all active:scale-95 text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-sm cursor-pointer"
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Handshake size={18} />
          )}
          {loading ? "Sending..." : "Offer"}
        </button>
      </div>
    </div>
  );
}