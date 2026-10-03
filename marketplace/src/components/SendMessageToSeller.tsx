"use client";

import { useState, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

interface SendMessageToSellerProps {
  sellerId: string;
  productId?: string;
  existingRoomId?: string | null;
  placeholder?: string;
}

// `border-border` is too light to see against stone-200, so every divider and
// outline uses these instead. Change them here to restyle all lines at once.
const LINE = "border-stone-400 dark:border-neutral-700";

const chipBase =
  "text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const chipOff =
  "bg-stone-200 text-black border-stone-800 hover:bg-emerald-50 hover:border-emerald-700 dark:bg-neutral-800 dark:text-white dark:border-neutral-700 dark:hover:bg-emerald-950 dark:hover:border-emerald-700";
const chipOn =
  "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 dark:bg-emerald-700 dark:border-emerald-600 dark:hover:bg-emerald-800";

export default function SendMessageToSeller({ sellerId, productId, existingRoomId, placeholder }: SendMessageToSellerProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingOwner, setCheckingOwner] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  // Quick reply templates
  const quickReplies = [
    "Is this still available?",
    "Are you open to negotiations?",
    "Where can we meetup?",
    "I'd like to buy this."
  ];

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

  async function onSend() {
    if (!text.trim() || loading || isOwner) return;

    if (!sellerId) {
      setError("The seller ID is missing.");
      console.error("SendMessageToSeller was rendered without a valid sellerId prop.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Get or create direct room using Supabase RPC
      const { data: roomId, error: roomError } = productId
        ? await supabase.rpc("get_or_create_product_room", { p_product_id: productId })
        : await supabase.rpc("get_or_create_direct_room", { p_other_user: sellerId });

      if (roomError || !roomId) {
        throw new Error(roomError?.message || "Failed to create direct message room.");
      }

      // 2. Insert message into direct_messages
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to send a message.");

      const { error: msgError } = await supabase.from("direct_messages").insert({
        room_id: roomId,
        sender_id: user.id,
        body: text.trim(),
      });

      if (msgError) throw new Error(msgError.message);

      // 3. Redirect to the direct chat room. The form stays in its loading
      // state until the navigation finishes, so a second click can't resend.
      router.push(`/chat/${roomId}?sellerId=${sellerId}${productId ? `&productId=${productId}` : ""}`);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (checkingOwner) {
    return (
      <div className={`pt-5 border-t ${LINE} flex justify-center py-6`}>
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (isOwner) {
    return (
      <div className={`pt-5 border-t ${LINE}`}>
        <div className={`w-full py-3.5 px-4 bg-stone-100 dark:bg-neutral-800 border ${LINE} text-muted-foreground font-semibold rounded-xl text-center text-sm cursor-not-allowed select-none`}>
          This is your listing. You cannot send a message to yourself.
        </div>
      </div>
    );
  }

  if (existingRoomId) {
    return (
      <div className={`pt-5 border-t ${LINE} space-y-2`}>
        <p className="text-xs font-semibold text-muted-foreground">
          You already have a conversation about this item.
        </p>
        <Link
          href={`/chat/${existingRoomId}?sellerId=${sellerId}${productId ? `&productId=${productId}` : ""}`}
          className="flex w-full items-center justify-center py-3 bg-foreground text-background font-bold rounded-xl text-sm hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          View conversation
        </Link>
      </div>
    );
  }

  return (
    <div className={`space-y-3 pt-5 border-t ${LINE}`}>

      {/* Quick Replies */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Quick replies">
        {quickReplies.map((reply) => {
          const selected = text === reply;
          return (
            <button
              key={reply}
              type="button"
              onClick={() => setText(reply)}
              disabled={loading}
              aria-pressed={selected}
              className={`${chipBase} ${selected ? chipOn : chipOff}`}
            >
              {reply}
            </button>
          );
        })}
      </div>

      {/* Message Input Area */}
      <div className="relative">
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder || "Type your message here..."}
          disabled={loading}
          aria-label="Message to seller"
          className="w-full bg-stone-200 border border-stone-800 rounded-xl pt-4 px-4 pb-14 text-neutral-900 placeholder:text-neutral-500 outline-none resize-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/30 transition-all text-sm font-medium disabled:opacity-50 dark:bg-neutral-800 dark:text-white dark:border-neutral-700 dark:placeholder:text-neutral-400 dark:focus:border-emerald-600"
        />

        {/* Floating Send Button */}
        <button
          type="button"
          onClick={onSend}
          disabled={!text.trim() || loading}
          aria-busy={loading}
          className="absolute bottom-3 right-3 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 border border-emerald-700 text-black font-bold text-sm rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-200 dark:focus-visible:ring-offset-neutral-800"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              Sending...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Send size={16} /> Send
            </span>
          )}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}