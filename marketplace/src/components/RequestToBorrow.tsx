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
  const [error, setError] = useState<string | null>(null);
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
      setError("Seller information is missing.");
      return;
    }

    setLoading(true);
    setError(null);

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

      // 3. Redirect to room. The button stays in its loading state until the
      // navigation finishes, so it can't be clicked twice.
      router.push(`/chat/${roomId}?sellerId=${sellerId}&productId=${productId}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  // Placeholder with the same height as the button, so the layout doesn't jump
  if (checkingOwner) {
    return (
      <div
        className="w-full h-[50px] rounded-xl bg-stone-200 dark:bg-neutral-800 animate-pulse"
        aria-hidden="true"
      />
    );
  }

  if (isOwner) return null; // Hide button entirely for own listing

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleRequest}
        disabled={loading}
        aria-busy={loading}
        className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold text-black bg-emerald-500 border border-emerald-600 shadow-md transition-colors hover:bg-emerald-600 hover:border-emerald-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:border-emerald-400/60 dark:hover:bg-emerald-400 dark:hover:border-emerald-300"
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Sending Request...
          </>
        ) : (
          <>
            <span aria-hidden="true">🤝</span>
            Request to Borrow
          </>
        )}
      </button>

      {error && (
        <p
          role="alert"
          className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}