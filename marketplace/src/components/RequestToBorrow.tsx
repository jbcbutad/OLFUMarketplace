"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export default function RequestToBorrow({
  sellerId,
  productTitle,
  productId
}: {
  sellerId: string;
  productTitle: string;
  productId: string;
}) {
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

  async function handleRequest() {
    if (loading || isOwner) return;

    if (!sellerId) {
      alert("Seller information is missing.");
      return;
    }

    setLoading(true);

    try {
      // 1. Get or create the chat room via Supabase RPC
      const { data: roomId, error: roomError } = await supabase.rpc("get_or_create_product_room", {
        p_product_id: productId,
      });

      if (roomError || !roomId) {
        throw new Error(roomError?.message || "Failed to initialize room.");
      }

      // 2. Transmit request message
      const borrowMessage = `🤝 Hi! I'd like to request to borrow your "${productTitle}". Let me know if it's available!`;

      const msgRes = await fetch("/api/direct-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          body: borrowMessage,
          image_url: null
        }),
      });

      const msgData = await msgRes.json().catch(() => ({}));
      if (!msgRes.ok) throw new Error(msgData.error || "Failed to send request message.");

      // 3. Redirect to room
      router.push(`/chat/${roomId}?sellerId=${sellerId}&productId=${productId}`);
      router.refresh();
    } catch (err: any) {
      alert("Error sending request: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (checkingOwner) {
    return (
      <div className="w-full flex justify-center py-3">
        <Loader2 size={20} className="animate-spin text-neutral-400" />
      </div>
    );
  }

  if (isOwner) return null; // Hide button entirely for own listing

  return (
    <button
      onClick={handleRequest}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-sm"
    >
      {loading ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          Sending Request...
        </>
      ) : (
        "🤝 Request to Borrow"
      )}
    </button>
  );
}