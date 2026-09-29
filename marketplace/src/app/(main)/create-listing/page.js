"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Camera, Loader2, Tag, PhilippinePeso, FileText,
  X, ImagePlus, ListFilter, Hash, ChevronLeft, Info, Plus, Sparkles, ShieldCheck, Layers, Calendar, CreditCard
} from "lucide-react";
import Link from "next/link";

const compressAndConvertToBase64 = (file, maxWidth = 1024, quality = 0.75) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      if (width > maxWidth || height > maxWidth) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxWidth) / height);
          height = maxWidth;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
      resolve(compressedBase64);
    };
    img.onerror = (err) => reject(err);
  });
};

// NEW: shrinks a photo to a small JPEG so a whole listing fits in one moderation request
const compressToBlob = (file, maxSize = 768, quality = 0.7) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("compress failed"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("load failed"));
    };
    img.src = url;
  });

function CreateListingContent() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");

  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [listingType, setListingType] = useState("Sale");

  // Verified Org States
  const [isVerifiedOrg, setIsVerifiedOrg] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [isOfficialOrgMerch, setIsOfficialOrgMerch] = useState(false);

  // Merch-specific fields
  const [stockQuantity, setStockQuantity] = useState("1");
  const [listingDuration, setListingDuration] = useState("");

  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [user, setUser] = useState(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const isMerchParam = searchParams.get("merch") === "true";

  const [submittedMerch, setSubmittedMerch] = useState(null);

  const suggestedTags = ["nursing", "medtech", "uniform", "secondhand", "calculator", "books", "brand new"];

  // 👉 Helper to extract number of days from duration input text (defaults to 1 day if not specified)
  const parseDays = (durationStr) => {
    const match = durationStr.match(/\d+/);
    return match ? parseInt(match[0]) : 1;
  };

  const totalDays = parseDays(listingDuration);
  const parsedStock = parseInt(stockQuantity) || 1;

  // ₱1.00 per item per day calculation formula
  const calculatedFee = isOfficialOrgMerch ? totalDays * 1 : 0;

  // Declared function handler for the official org merch checkbox toggle
  const handleOfficialOrgMerchToggle = (checked) => {
    setIsOfficialOrgMerch(checked);
    if (checked) {
      const merchCategory = categories.find(c => c.name.toLowerCase() === "merchandise");
      if (merchCategory) {
        setCategoryId(merchCategory.id);
      } else {
        supabase
          .from("categories")
          .select("id")
          .ilike("name", "merchandise")
          .maybeSingle()
          .then(({ data }) => {
            if (data) setCategoryId(data.id);
          });
      }

      if (!tags.includes("official-merch")) {
        setTags(prev => [...prev, "official-merch"]);
      }
    } else {
      setTags(tags.filter(t => t !== "official-merch"));
    }
  };

  useEffect(() => {
    const initializeForm = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);

      // Check profile verification
      const { data: profileData } = await supabase
        .from("profiles")
        .select("is_verified_org, org_name")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profileData?.is_verified_org) {
        setIsVerifiedOrg(true);
        setOrgName(profileData.org_name || "Organization");

        if (isMerchParam) {
          handleOfficialOrgMerchToggle(true);
        }
      }

      const { data: catData } = await supabase.from("categories").select("id, name").order("name");
      if (catData) {
        setCategories(catData);
        if (isMerchParam && profileData?.is_verified_org) {
          const merchCat = catData.find(c => c.name.toLowerCase() === "merchandise");
          if (merchCat) setCategoryId(merchCat.id);
        }
      }
    };

    initializeForm();
  }, [router, isMerchParam]);

  const addTag = (tagToAdd) => {
    const cleanTag = tagToAdd.trim().toLowerCase();
    if (cleanTag && !tags.includes(cleanTag)) {
      setTags([...tags, cleanTag]);
    }
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleImageChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (images.length + selectedFiles.length > 10) {
      alert("You can only upload a maximum of 10 images.");
      return;
    }
    if (selectedFiles.length > 0) {
      setImages((prev) => [...prev, ...selectedFiles]);
      const newPreviews = selectedFiles.map((file) => URL.createObjectURL(file));
      setPreviewUrls((prev) => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (indexToRemove) => {
    setImages((prev) => prev.filter((_, index) => index !== indexToRemove));
    setPreviewUrls((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleAutoFillAI = async () => {
    if (images.length === 0 && !description) {
      alert("Please upload at least one image or type a short note first!");
      return;
    }

    setAiLoading(true);

    try {
      let base64Image = null;
      if (images.length > 0) {
        base64Image = await compressAndConvertToBase64(images[0]);
      }

      const res = await fetch("/api/generate-listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Image,
          description: description,
        }),
      });

      const data = await res.json();

      if (data.success && data.listing) {
        const { title: aiTitle, description: aiDesc, price: aiPrice, suggestedTags: aiTags } = data.listing;

        if (aiTitle) setTitle(aiTitle);
        if (aiDesc) setDescription(aiDesc);
        if (aiPrice !== undefined && aiPrice !== null) setPrice(aiPrice.toString());

        if (aiTags && Array.isArray(aiTags)) {
          const cleanAiTags = aiTags.map(t => t.trim().toLowerCase());
          setTags(prev => [...new Set([...prev, ...cleanAiTags])]);
        }
      } else {
        alert(data.error || "Failed to generate details with AI.");
      }
    } catch (err) {
      console.error("AI Generation error:", err);
      alert("Error generating details with AI.");
    } finally {
      setAiLoading(false);
    }
  };

  // NEW: sends every photo to /api/moderate-image in one request.
  // Returns one { verdict, categories, reason } per photo, in the same order as `files`.
  // Anything that cannot be checked is held for review ("flagged") instead of passing through.
  const moderateImages = async (files) => {
    const held = (reason) => ({ verdict: "flagged", categories: [], reason });
    const results = files.map(() => held("moderation_unavailable"));

    const blobs = await Promise.all(files.map((f) => compressToBlob(f).catch(() => null)));
    const sendable = [];
    blobs.forEach((blob, i) => {
      if (blob) sendable.push({ i, blob });
      else results[i] = held("could_not_read_image");
    });
    if (sendable.length === 0) return results;

    const form = new FormData();
    sendable.forEach(({ blob }, k) => form.append("images", blob, `photo-${k}.jpg`));

    const res = await fetch("/api/moderate-image", { method: "POST", body: form });
    if (res.status === 401) throw new Error("Your session expired. Please log in again.");
    if (!res.ok) return results; // stays held for review

    const data = await res.json();
    sendable.forEach(({ i }, k) => {
      if (data.results?.[k]) results[i] = data.results[k];
    });
    return results;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (images.length === 0) return alert("Please upload at least one image!");
    if (!categoryId) return alert("Please select a category!");
    setLoading(true);

    try {
      // NEW: check every photo before anything is uploaded
      const results = await moderateImages(images);

      const rejectedIndex = results.findIndex((r) => r.verdict === "rejected");
      if (rejectedIndex !== -1) {
        const why = (results[rejectedIndex].reason || "it appears to break our posting rules").replace(/[.\s]+$/, "");
        alert(`Photo ${rejectedIndex + 1} can't be used: ${why}. Please remove it and try again.`);
        return;
      }

      const flaggedIndexes = results
        .map((r, i) => (r.verdict === "flagged" ? i : -1))
        .filter((i) => i !== -1);
      const needsReview = flaggedIndexes.length > 0;

      const uploadPromises = images.map(async (image) => {
        const fileExt = image.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `listings/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, image);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        return publicUrl;
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      let finalCategoryId = categoryId;
      let finalTags = [...new Set([...tags, listingType])];

      if (isOfficialOrgMerch) {
        const merchCat = categories.find(c => c.name.toLowerCase() === "merchandise");
        if (merchCat) {
          finalCategoryId = merchCat.id;
        }
        if (!finalTags.includes("official-merch")) {
          finalTags.push("official-merch");
        }
      }

      // NEW: created here so the flags can point at this listing without reading it back
      const productId = crypto.randomUUID();

      const merchCategory = categories.find(
        (c) => c.name.toLowerCase() === "merchandise"
      );

      if (
        merchCategory &&
        finalCategoryId === merchCategory.id &&
        !isVerifiedOrg
      ) {
        throw new Error("Only verified organizations can create merchandise listings.");
      }

      const productPayload = {
        id: productId, // NEW
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price),
        image_urls: uploadedUrls,
        seller_id: user.id,
        category_id: finalCategoryId,
        tags: finalTags,
        price_type: 'Fixed',
        is_available: !needsReview, // CHANGED (was: true)
        is_published: !needsReview, // NEW
        status: needsReview ? "flagged" : isOfficialOrgMerch ? "pending" : "active", // CHANGED
        stock_quantity: parsedStock,
        listing_duration: isOfficialOrgMerch ? listingDuration.trim() : null,
        listing_fee: calculatedFee
      };

      const { error: dbError } = await supabase
        .from("products")
        .insert([productPayload]);

      if (dbError) throw dbError;

      // NEW: record the flagged photos so moderators see them on /admin/flagged
      if (needsReview) {
        const { error: flagError } = await supabase.from("moderation_flags").insert(
          flaggedIndexes.map((i) => ({
            user_id: user.id,
            product_id: productId,
            image_url: uploadedUrls[i],
            verdict: "flagged",
            categories: results[i].categories || [],
            reason: results[i].reason || null,
          }))
        );
        if (flagError) throw flagError;

        alert("Your listing was submitted, but a photo needs a quick check by our moderators. It will go live once approved.");
      }

      // Trigger payment instruction modal for merch drops instead of direct router redirect
      if (isOfficialOrgMerch) {
        setSubmittedMerch({
          title: title.trim(),
          fee: calculatedFee,
          stock: parsedStock,
          duration: listingDuration.trim()
        });
      } else {
        router.push("/mylistings");
        router.refresh();
      }

    } catch (error) {
      console.error("Submission error:", error);
      alert(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-foreground w-full min-h-screen p-6 md:p-10 transition-colors">
      <div className="max-w-3xl mx-auto">

        {/* HEADER */}
        <div className="flex items-center gap-4 mb-10">
          <Link href="/mylistings" className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors">
            <ChevronLeft size={24} className="text-foreground" />
          </Link>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">New Listing</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* TOGGLE TYPE */}
          <section>
            <label className="text-sm font-bold text-neutral-600 dark:text-neutral-400 mb-3 block">Listing Type</label>
            <div className="grid grid-cols-2 gap-4 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setListingType("Sale")}
                className={`py-3 px-4 rounded-xl text-sm font-bold transition-all ${listingType === "Sale" ? "bg-foreground text-background shadow-lg" : "text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"}`}
              >
                For Sale
              </button>
              <button
                type="button"
                onClick={() => setListingType("Rentals")}
                className={`py-3 px-4 rounded-xl text-sm font-bold transition-all ${listingType === "Rentals" ? "bg-foreground text-background shadow-lg" : "text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"}`}
              >
                For Rent
              </button>
            </div>
          </section>

          {/* VERIFIED ORG EXCLUSIVE TOGGLE OPTION */}
          {isVerifiedOrg && (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-4 transition-all">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-md shrink-0">
                  <ShieldCheck size={22} />
                </div>
                <div className="space-y-1 flex-grow">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                      Official Organization Merch ({orgName})
                    </h3>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isOfficialOrgMerch}
                        onChange={(e) => handleOfficialOrgMerchToggle(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-neutral-300 peer-focus:outline-none rounded-full peer dark:bg-neutral-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-300">
                    Enable this to list official organization merchandise requiring stock tracking and admin payment verification.
                  </p>
                </div>
              </div>

              {/* MERCH PARAMETERS EXPANSION */}
              {isOfficialOrgMerch && (
                <div className="pt-4 border-t border-emerald-500/20 space-y-4 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative">
                      <label className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1.5 block">
                        Stock Quantity (Units)
                      </label>
                      <Layers className="absolute left-3.5 top-[38px] text-emerald-600 dark:text-emerald-400" size={16} />
                      <input
                        required={isOfficialOrgMerch}
                        type="number"
                        min="1"
                        className="w-full bg-background border border-emerald-500/30 rounded-xl p-3 pl-10 text-foreground text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="e.g., 50"
                        value={stockQuantity}
                        onChange={(e) => setStockQuantity(e.target.value)}
                      />
                    </div>

                    <div className="relative">
                      <label className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1.5 block">
                        Listing Duration
                      </label>
                      <Calendar className="absolute left-3.5 top-[38px] text-emerald-600 dark:text-emerald-400" size={16} />
                      <input
                        required={isOfficialOrgMerch}
                        type="text"
                        className="w-full bg-background border border-emerald-500/30 rounded-xl p-3 pl-10 text-foreground text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="e.g., How many days"
                        value={listingDuration}
                        onChange={(e) => setListingDuration(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Fee Breakdown Display (₱1 / day flat rate) */}
                  <div className="p-3.5 bg-background/80 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    <span className="flex items-center gap-2">
                      <CreditCard size={16} className="text-emerald-600" /> Platform Listing Fee (₱1.00 / day):
                    </span>
                    <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                      ₱{calculatedFee.toFixed(2)} ({totalDays} {totalDays === 1 ? 'day' : 'days'} total)
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* IMAGES */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-bold text-neutral-600 dark:text-neutral-400">Product Images</label>
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">{images.length} / 10</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {images.length < 10 && (
                <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-2xl cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-all">
                  <ImagePlus className="text-neutral-400 mb-1" size={24} />
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">Add Photo</span>
                  <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageChange} />
                </label>
              )}

              {previewUrls.map((url, index) => (
                <div key={index} className="relative aspect-square rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 group shadow-sm">
                  <img src={url} alt="Preview" className="w-full h-full object-cover" />
                  {index === 0 && <div className="absolute top-2 left-2 bg-foreground text-background text-[9px] px-2 py-0.5 rounded font-bold uppercase">Cover</div>}
                  <button type="button" onClick={() => removeImage(index)} className="absolute top-2 right-2 bg-background/90 p-1.5 rounded-full text-red-500 shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* AI AUTO-FILL BANNER */}
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-400/10 border border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-400 text-amber-950 rounded-xl shadow-md font-bold">
                  <Sparkles size={20} />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-foreground">Save time with AI Auto-Fill</p>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Upload an image or type a short note to generate title, price, description & tags.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAutoFillAI}
                disabled={aiLoading || (images.length === 0 && !description)}
                className="w-full sm:w-auto px-5 py-2.5 bg-amber-400 text-amber-950 text-xs font-extrabold rounded-xl shadow-md hover:bg-amber-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {aiLoading ? (
                  <><Loader2 className="animate-spin" size={16} /> Analyzing...</>
                ) : (
                  <><Sparkles size={16} /> Auto-Fill with AI</>
                )}
              </button>
            </div>
          </div>

          {/* BASIC INFO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 relative">
              <label className="text-sm font-bold text-neutral-600 dark:text-neutral-400 mb-2 block">Product Title</label>
              <Tag className="absolute left-4 top-[46px] text-neutral-400" size={18} />
              <input
                required
                className="w-full bg-background border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 pl-12 text-foreground outline-none focus:ring-2 focus:ring-foreground transition-all placeholder:text-neutral-400"
                placeholder="What are you selling?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="relative">
              <label className="text-sm font-bold text-neutral-600 dark:text-neutral-400 mb-2 block">Category</label>
              <ListFilter className="absolute left-4 top-[46px] text-neutral-400" size={18} />
              <select
                required
                className="w-full bg-background border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 pl-12 text-foreground outline-none focus:ring-2 focus:ring-foreground appearance-none cursor-pointer"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="" className="bg-background text-foreground">Select Category</option>
                {categories
                  .filter(cat =>
                    isVerifiedOrg ||
                    cat.name.toLowerCase() !== "merchandise"
                  )
                  .map((cat) => (
                    <option
                      key={cat.id}
                      value={cat.id}
                      className="bg-background text-foreground"
                    >
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="relative">
              <label className="text-sm font-bold text-neutral-600 dark:text-neutral-400 mb-2 block">Price</label>
              <span className="absolute left-4 top-[46px] text-neutral-400 font-bold">₱</span>
              <input
                required
                type="number"
                className="w-full bg-background border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 pl-10 text-foreground outline-none focus:ring-2 focus:ring-foreground transition-all placeholder:text-neutral-400"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>

          {/* TAGS SECTION */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-neutral-600 dark:text-neutral-400 block">Product Tags</label>
              <span className="text-xs text-neutral-400 flex items-center gap-1">
                <Info size={12} /> Press Enter or Comma to add
              </span>
            </div>

            <div className="flex flex-wrap gap-2 p-3 min-h-[58px] bg-background border border-neutral-300 dark:border-neutral-700 rounded-xl focus-within:ring-2 focus-within:ring-foreground transition-all">
              {tags.map((tag, idx) => (
                <span key={idx} className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 text-foreground px-3 py-1 rounded-lg text-xs font-bold border border-neutral-300 dark:border-neutral-700">
                  #{tag}
                  <X size={14} className="cursor-pointer hover:text-red-500" onClick={() => removeTag(tag)} />
                </span>
              ))}
              <input
                className="bg-transparent outline-none text-foreground text-sm flex-grow min-w-[140px] placeholder:text-neutral-400"
                placeholder={tags.length === 0 ? "Type tag & press Enter..." : ""}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
              />
            </div>

            <div className="pt-1">
              <p className="text-[11px] text-neutral-500 font-medium mb-1.5">Click to quick-add tags:</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestedTags.map((suggestion) => {
                  const isAdded = tags.includes(suggestion);
                  return (
                    <button
                      key={suggestion}
                      type="button"
                      disabled={isAdded}
                      onClick={() => addTag(suggestion)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-all flex items-center gap-1 ${isAdded
                        ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-400 border-transparent cursor-not-allowed"
                        : "bg-background border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-foreground"}`}
                    >
                      <Plus size={10} /> #{suggestion}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* DESCRIPTION */}
          <div className="relative">
            <label className="text-sm font-bold text-neutral-600 dark:text-neutral-400 mb-2 block">Description</label>
            <FileText className="absolute left-4 top-[46px] text-neutral-400" size={18} />
            <textarea
              rows="4"
              required
              className="w-full bg-background border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 pl-12 text-foreground outline-none focus:ring-2 focus:ring-foreground transition-all resize-none placeholder:text-neutral-400"
              placeholder="Tell buyers more about your product..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* SUBMIT */}
          <div className="pt-6">
            <button
              type="submit"
              disabled={loading || images.length === 0}
              className="w-full bg-foreground text-background border border-foreground font-bold py-5 rounded-2xl flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <><Loader2 className="animate-spin" size={20} /> Processing Listing...</>
              ) : isOfficialOrgMerch ? (
                `Submit Merchandise (Fee: ₱${calculatedFee.toFixed(2)})`
              ) : (
                "Post Listing Now"
              )}
            </button>
          </div>
        </form>

        {/* 👉 PAYMENT INSTRUCTIONS MODAL (Placed properly INSIDE the main return layout) */}
        {submittedMerch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 rounded-3xl max-w-md w-full shadow-2xl space-y-6">

              <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-4">
                <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
                  <CreditCard size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Payment Required</h3>
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
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">0912 345 6789</p>
                  <p className="text-[11px] text-neutral-500">Account Name: OLFU Marketplace Admin</p>
                </div>

                <div className="space-y-1.5 text-neutral-600 dark:text-neutral-300">
                  <p className="font-bold text-foreground">Steps after paying:</p>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                    <li>Take a screenshot of your GCash payment receipt.</li>
                    <li>Send an email to <strong className="text-foreground">olfumarketplace@gmail.com</strong>.</li>
                    <li>Include your item title (<span className="italic">"{submittedMerch.title}"</span>) and attach the receipt screenshot.</li>
                  </ol>
                </div>
              </div>

              <button
                onClick={() => {
                  setSubmittedMerch(null);
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

      </div>
    </div>
  );
}

export default function CreateListing() {
  return (
    <Suspense fallback={null}>
      <CreateListingContent />
    </Suspense>
  );
}