"use client";
import { useState, useRef } from "react";
import { Send, Image as ImageIcon, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client"; 

export default function ChatInput({ roomId, sellerId }) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isSending, setIsSending] = useState(false);
  
  const fileInputRef = useRef(null);
  const router = useRouter();

  function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const MAX_FILE_SIZE = 8 * 1024 * 1024; 
    if (file.size > MAX_FILE_SIZE) {
      alert("Image is too large! Please select an image smaller than 8MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    
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
        alert(data.error || "Failed to send message.");
      }
    } catch (error) {
      alert(error.message || "Something went wrong.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="p-4 bg-background text-foreground flex flex-col gap-2 shrink-0 transition-colors">
      
      {/* Image Preview Area */}
      {previewUrl && (
        <div className="relative self-start inline-block ml-2 mb-1 shrink-0">
          <img 
            src={previewUrl} 
            alt="Upload preview" 
            className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg border border-neutral-300 dark:border-neutral-700 object-cover block"
          />
          <button
            onClick={clearImage}
            type="button"
            className="absolute -top-1.5 -right-1.5 bg-foreground text-background rounded-full p-1 shadow-md hover:opacity-80 transition-opacity"
          >
            <X size={10} />
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
        
        <div className="flex-1 flex items-center bg-neutral-100 dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-full pl-3 pr-1 py-1 focus-within:ring-2 focus-within:ring-foreground transition-all">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            type="button"
            className="text-neutral-500 hover:text-foreground dark:text-neutral-400 p-1.5 rounded-full transition-colors shrink-0 disabled:opacity-50"
          >
            <ImageIcon size={22} />
          </button>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            disabled={isSending}
            className="w-full bg-transparent text-foreground px-3 py-1.5 focus:outline-none disabled:opacity-50 placeholder:text-neutral-400 text-sm"
          />
        </div>
        
        <button
          type="submit"
          disabled={isSending || (!text.trim() && !imageFile)}
          className="bg-foreground text-background p-2.5 rounded-full hover:opacity-90 transition-opacity flex items-center justify-center shrink-0 disabled:opacity-50"
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