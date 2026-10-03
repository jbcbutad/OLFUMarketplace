"use client";
import { useState, useRef } from "react";
import { Send, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

// Explicit light/dark colors instead of theme tokens (bg-background,
// text-foreground, bg-foreground...). The footer bar in ChatRoom provides the
// background, so this component doesn't set one. Change the values here to
// restyle the whole input.
const LINE = "border-stone-400 dark:border-neutral-700";
const TEXT = "text-neutral-900 dark:text-white";

export default function ChatInput({ roomId, sellerId }) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);
  const router = useRouter();

  function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_FILE_SIZE = 8 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setError("Image is too large. Please select an image smaller than 8MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setError(null);
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSend(e) {
    if (e) e.preventDefault();
    if ((!text.trim() && !imageFile) || isSending) return;
    setIsSending(true);
    setError(null);

    let finalImageUrl = null;
    let targetRoomId = roomId;

    try {
      // 1. Resolve or Create Direct Room if roomId is temporary or invalid UUID
      if ((!targetRoomId || targetRoomId === "new" || targetRoomId === sellerId) && sellerId) {
        const { data: generatedRoomId, error: rpcError } = await supabase
          .rpc("get_or_create_direct_room", { p_other_user: sellerId });

        if (rpcError) throw new Error("Failed to initialize chat room.");
        targetRoomId = generatedRoomId;

        // Update URL to newly resolved room ID without reloading
        window.history.replaceState(null, "", `/chat/${targetRoomId}?sellerId=${sellerId}`);
      }

      // 2. Upload image to Supabase storage if selected
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-images")
          .upload(fileName, imageFile);

        if (uploadError) throw new Error("Failed to upload image.");

        const { data: urlData } = supabase.storage
          .from("chat-images")
          .getPublicUrl(fileName);

        finalImageUrl = urlData.publicUrl;
      }

      // 3. Post message to API endpoint
      const res = await fetch("/api/direct-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: targetRoomId,
          body: text.trim() || "Sent an image",
          image_url: finalImageUrl
        }),
      });

      if (res.ok) {
        setText("");
        clearImage();
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to send message.");
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className={`p-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${TEXT} flex flex-col gap-2 shrink-0 transition-colors`}>

      {error && (
        <p role="alert" className="px-2 text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      {/* Image Preview Area */}
      {previewUrl && (
        <div className="relative self-start inline-block ml-2 mb-1 shrink-0">
          <img
            src={previewUrl}
            alt="Upload preview"
            className={`h-16 w-16 sm:h-20 sm:w-20 rounded-lg border ${LINE} object-cover block`}
          />
          <button
            onClick={clearImage}
            type="button"
            aria-label="Remove image"
            className="absolute -top-2 -right-2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-full p-1.5 shadow-md hover:opacity-80 transition-opacity cursor-pointer"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <form onSubmit={handleSend} className="flex gap-2 items-center w-full shrink-0">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImageSelect}
        />

        <div className="flex-1 flex items-center bg-stone-100 border border-stone-800 rounded-full pl-3 pr-1 py-1 transition-all focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-600/30 dark:bg-neutral-800 dark:border-neutral-700 dark:focus-within:border-emerald-600">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            type="button"
            aria-label="Attach image"
            className="text-neutral-600 hover:text-neutral-900 hover:bg-stone-200 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-700 p-1.5 rounded-full transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <ImageIcon size={22} />
          </button>

          <input
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Type a message..."
            aria-label="Message"
            disabled={isSending}
            className={`w-full bg-transparent ${TEXT} px-3 py-1.5 focus:outline-none disabled:opacity-50 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 text-base sm:text-sm`}
          />
        </div>

        <button
          type="submit"
          disabled={isSending || (!text.trim() && !imageFile)}
          aria-label="Send message"
          className="bg-emerald-500 hover:bg-emerald-600 border border-emerald-700 text-black p-2.5 rounded-full transition-colors flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-200 dark:focus-visible:ring-offset-neutral-900"
        >
          {isSending ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Send size={20} className="ml-0.5" />
          )}
        </button>
      </form>
    </div>
  );
}