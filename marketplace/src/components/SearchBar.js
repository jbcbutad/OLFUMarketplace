"use client";

import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Search, Loader2, Mic, Camera, X, ShieldCheck } from "lucide-react";
import { isMerch } from "@/lib/merch";

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const router = useRouter();
  const wrapperRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null); // Keeps track of active speech instance

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!query.trim()) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }

      setIsLoading(true);

      const nowIso = new Date().toISOString();

      const { data, error } = await supabase
        .from("products")
        .select("id, title, tags, categories ( name ), profiles ( is_verified_org )")
        .ilike("title", `%${query}%`)
        .eq("is_available", true)
        .eq("status", "active")
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .limit(5);

      if (!error && data) {
        setSuggestions(
          data.filter((p) => !isMerch(p) || p.profiles?.is_verified_org)
        );
        setShowDropdown(true);
      }
      setIsLoading(false);
    };

    const timeoutId = setTimeout(() => {
      fetchSuggestions();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleVoiceSearch = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Voice search is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    // Toggle off if already listening
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-PH";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");

      setQuery(transcript);
    };

    recognition.onerror = (event) => {
      // Silently swallow harmless abort errors during route changes or manual stops
      if (event.error === "aborted") {
        setIsListening(false);
        return;
      }

      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setPreviewImage(previewUrl);
    setIsAnalyzing(true);
    setShowDropdown(false);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/search-by-image", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.query) {
        const searchTerm = data.query.trim();
        setQuery(searchTerm);
        executeSearch(searchTerm);
      } else {
        toast.error(data.error || "Failed to analyze image.");
      }
    } catch (err) {
      console.error("Image search error:", err);
      toast.error("Failed to analyze image for search.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClearImage = () => {
    setPreviewImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const executeSearch = (searchTerm) => {
    if (searchTerm.trim()) {
      // Stop speech recognition if still active prior to route change
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setShowDropdown(false);
      router.push(`/search?q=${encodeURIComponent(searchTerm)}`);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    executeSearch(query);
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion.title);
    setShowDropdown(false);
    router.push(`/products/${suggestion.id}`);
  };

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Pill Container */}
      <form
        onSubmit={handleSearch}
        className="flex items-center border border-neutral-300 dark:border-neutral-700 bg-background rounded-full overflow-hidden w-full focus-within:ring-2 focus-within:ring-yellow-500 transition-all"
      >
        <input
          type="text"
          placeholder={
            isListening
              ? "Listening..."
              : isAnalyzing
                ? "Analyzing photo..."
                : "Search listings..."
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setShowDropdown(true)}
          disabled={isAnalyzing}
          className="px-4 py-2 focus:outline-none text-foreground bg-transparent w-full text-sm placeholder:text-neutral-400"
        />

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0 pr-1">
          {previewImage && (
            <div className="relative flex items-center mr-1">
              <img
                src={previewImage}
                alt="Uploaded thumbnail"
                className="w-6 h-6 object-cover rounded-full border border-yellow-500"
              />
              <button
                type="button"
                onClick={handleClearImage}
                className="absolute -top-1 -right-1 bg-neutral-900 text-white rounded-full p-0.5 hover:bg-neutral-700"
              >
                <X size={10} />
              </button>
            </div>
          )}

          {(isLoading || isAnalyzing) && (
            <Loader2 className="animate-spin text-yellow-500 mr-1" size={18} />
          )}

          {/* Voice Search Mic Button */}
          <button
            type="button"
            onClick={handleVoiceSearch}
            title={isListening ? "Listening..." : "Search with voice"}
            className={`p-1.5 rounded-full transition-all flex items-center justify-center ${isListening
              ? "text-red-500 bg-red-500/20 animate-pulse ring-1 ring-red-500"
              : "text-neutral-500 dark:text-neutral-400 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
          >
            <Mic size={18} />
          </button>

          {/* Camera Search Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            title="Search by photo with AI"
            className="p-1.5 text-neutral-500 dark:text-neutral-400 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-all disabled:opacity-50 flex items-center justify-center"
          >
            <Camera size={18} />
          </button>
        </div>

        {/* Yellow Search Button */}
        <button
          type="submit"
          className="bg-yellow-500 px-5 py-2.5 text-black font-bold hover:bg-yellow-600 transition-colors flex items-center justify-center shrink-0"
        >
          <Search size={18} />
        </button>
      </form>

      {/* SUGGESTIONS DROPDOWN */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl overflow-hidden z-50">
          <ul>
            {suggestions.map((item) => (
              <li
                key={item.id}
                onClick={() => handleSuggestionClick(item)}
                className="px-4 py-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-foreground cursor-pointer transition-colors border-b border-neutral-200 dark:border-neutral-800/50 last:border-0 flex items-center gap-2 text-sm"
              >
                <Search size={14} className="text-neutral-400 shrink-0" />
                <span className="flex-1 truncate">{item.title}</span>
                {isMerch(item) && (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                    <ShieldCheck size={10} /> Official Merch
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No suggestions state */}
      {showDropdown && suggestions.length === 0 && !isLoading && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl p-4 text-center z-50">
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">
            No suggestions found. Press Enter to search all.
          </p>
        </div>
      )}
    </div>
  );
}