"use client";

import { useState, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

interface SendMessageToSellerProps {
  sellerId: string;
  placeholder?: string;
}

export default function SendMessageToSeller({ sellerId, placeholder }: SendMessageToSellerProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingOwner, setCheckingOwner] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  
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
      alert("The Seller ID is missing.");
      console.error("SendMessageToSeller was rendered without a valid sellerId prop.");
      return;
    }

    setLoading(true);

    try {
      // 1. Get or create direct room using Supabase RPC
      const { data: roomId, error: roomError } = await supabase.rpc("get_or_create_direct_room", {
        p_other_user: sellerId,
      });

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

      // 3. Redirect to the direct chat room
      router.push(`/chat/${roomId}?sellerId=${sellerId}`);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (checkingOwner) {
    return (
      <div className="pt-5 border-t border-border flex justify-center py-6">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (isOwner) {
    return (
      <div className="pt-5 border-t border-border">
        <div className="w-full py-3.5 bg-muted border border-border text-muted-foreground font-semibold rounded-xl text-center text-sm cursor-not-allowed select-none">
          This is your listing. You cannot send a message to yourself.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-5 border-t border-border">
      
      {/* Quick Replies */}
      <div className="flex flex-wrap gap-2 mb-2">
        {quickReplies.map((reply, index) => (
          <button
            key={index}
            onClick={() => setText(reply)}
            disabled={loading}
            className="text-xs font-semibold px-3.5 py-1.5 bg-muted hover:bg-accent text-foreground rounded-full border border-border transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {reply}
          </button>
        ))}
      </div>

      {/* Message Input Area */}
      <div className="relative">
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder || "Type your message here..."}
          disabled={loading}
          className="w-full bg-muted border border-border rounded-xl pt-4 px-4 pb-14 text-foreground placeholder:text-muted-foreground/60 outline-none resize-none focus:ring-2 focus:ring-foreground/20 transition-all text-sm disabled:opacity-50 font-medium"
        />
        
        {/* Floating Send Button */}
        <button
          onClick={onSend}
          disabled={!text.trim() || loading}
          className="absolute bottom-3 right-3 flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold text-sm rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer"
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
    </div>
  );
}