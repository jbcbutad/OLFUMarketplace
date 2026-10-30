"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2, Tag, FileText,
  X, ImagePlus, ListFilter, ChevronLeft, Info, Plus, Sparkles, ShieldCheck, Layers, Calendar, CreditCard, ShoppingBag
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const compressAndConvertToBase64 = (file, maxWidth = 1024, quality = 0.75) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
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
      URL.revokeObjectURL(objectUrl);
      resolve(compressedBase64);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
  });
};

// Shrinks a photo to a small JPEG so a whole listing fits in one moderation request
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

// Tags the app controls: users can't add these by hand, and they aren't sent to AI moderation
const RESERVED_TAGS = ["official-merch", "flagged", "pending", "expired"];

// Only these photo formats are accepted (Gemini-safe; everything is re-encoded to JPEG later)
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"];
const MAX_IMAGE_MB = 10;
const MAX_TITLE = 100;
const MAX_DESCRIPTION = 1000;
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 30;
const MAX_STOCK = 999;
const MAX_DAYS = 90;
const MAX_PRICE = 999999999;

// Formats a price as you type: commas, max 9 whole digits, max 2 decimals
const formatPrice = (value) => {
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const [rawInt, ...rest] = cleaned.split(".");
  const intPart = rawInt.slice(0, 9);
  const decimals = rest.join("").slice(0, 2);
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return rest.length > 0 ? `${withCommas}.${decimals}` : withCommas;
};

const checkImage = (file) => {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(file.type) || !ALLOWED_IMAGE_EXTS.includes(ext)) {
    return `"${file.name}" isn't allowed. Please use JPG, PNG or WEBP photos only.`;
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    return `"${file.name}" is larger than ${MAX_IMAGE_MB} MB.`;
  }
  return null;
};

// Validates one tag against a list. Returns { list, error }.
const tryAddTag = (currentTags, raw) => {
  const cleanTag = String(raw).trim().toLowerCase();
  if (!cleanTag) return { list: currentTags, error: null };
  if (RESERVED_TAGS.includes(cleanTag)) {
    return { list: currentTags, error: `"${cleanTag}" is a reserved tag and can't be added manually.` };
  }
  if (currentTags.includes(cleanTag)) return { list: currentTags, error: null };
  if (cleanTag.length > MAX_TAG_LENGTH) {
    return { list: currentTags, error: `Tags can be at most ${MAX_TAG_LENGTH} characters.` };
  }
  if (currentTags.length >= MAX_TAGS) {
    return { list: currentTags, error: `You can add up to ${MAX_TAGS} tags.` };
  }
  return { list: [...currentTags, cleanTag], error: null };
};

// Formats a number like ₱280.00
const formatPeso = (n) =>
  `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  const [durationDays, setDurationDays] = useState("");

  const [images, setImages] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const previewUrlsRef = useRef([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [user, setUser] = useState(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const isMerchParam = searchParams.get("merch") === "true";

  const [submittedMerch, setSubmittedMerch] = useState(null);

  const suggestedTags = ["nursing", "medtech", "uniform", "secondhand", "calculator", "books", "brand new"];

  // Number of days is a plain number now (no free text), so the fee can't be miscalculated
  const totalDays = parseInt(durationDays, 10) || 0;
  const parsedStock = parseInt(stockQuantity, 10);

  // Flat ₱1.00 per day (stock quantity does not change the fee)
  const calculatedFee = isOfficialOrgMerch ? totalDays * 1 : 0;

  const handleOfficialOrgMerchToggle = (checked) => setIsOfficialOrgMerch(checked);

  // Keep a ref of the preview URLs so they can be revoked when the page unmounts
  useEffect(() => {
    previewUrlsRef.current = previewUrls;
  }, [previewUrls]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

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
      if (catData) setCategories(catData);
    };

    initializeForm();
  }, [router, isMerchParam]);

  const addTag = (tagToAdd) => {
    const { list, error } = tryAddTag(tags, tagToAdd);
    if (error) {
      toast.error(error);
      return;
    }
    if (list !== tags) setTags(list);
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
    e.target.value = "";

    const valid = [];
    for (const file of selectedFiles) {
      const problem = checkImage(file);
      if (problem) toast.error(problem);
      else valid.push(file);
    }

    if (valid.length === 0) return;
    if (images.length + valid.length > 10) {
      toast.error("You can only upload a maximum of 10 images.");
      return;
    }

    setImages((prev) => [...prev, ...valid]);
    setPreviewUrls((prev) => [...prev, ...valid.map((f) => URL.createObjectURL(f))]);
  };

  const removeImage = (indexToRemove) => {
    const urlToRevoke = previewUrls[indexToRemove];
    if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    setImages((prev) => prev.filter((_, index) => index !== indexToRemove));
    setPreviewUrls((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleAutoFillAI = async () => {
    if (images.length === 0 && !description) {
      toast.error("Please upload at least one image or type a short note first!");
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

        if (aiTitle) setTitle(String(aiTitle).slice(0, MAX_TITLE));
        if (aiDesc) setDescription(String(aiDesc).slice(0, MAX_DESCRIPTION));
        if (aiPrice !== undefined && aiPrice !== null) setPrice(formatPrice(aiPrice));

        if (aiTags && Array.isArray(aiTags)) {
          setTags((prev) => {
            let next = prev;
            for (const t of aiTags) {
              if (typeof t !== "string") continue;
              next = tryAddTag(next, t).list; // silently skips reserved / too long / over the limit
            }
            return next;
          });
        }
      } else {
        toast.error(data.error || "Failed to generate details with AI.");
      }
    } catch (err) {
      console.error("AI Generation error:", err);
      toast.error("Error generating details with AI.");
    } finally {
      setAiLoading(false);
    }
  };

  // Sends the listing text, tags and every photo to /api/moderate-listing in one request.
  const moderateListing = async (tagList) => {
    const form = new FormData();

    form.append("title", title.trim());
    form.append("description", description.trim());
    form.append(
      "tags",
      JSON.stringify(tagList.filter((t) => !RESERVED_TAGS.includes(t.toLowerCase())))
    );

    const blobs = await Promise.all(
      images.map((file) => compressToBlob(file))
    );

    blobs.forEach((blob, index) => {
      if (blob) {
        form.append(
          "images",
          blob,
          `photo-${index}.jpg`
        );
      }
    });

    const res = await fetch("/api/moderate-listing", {
      method: "POST",
      body: form,
    });

    if (res.status === 401) {
      throw new Error(
        "Your session expired. Please log in again."
      );
    }

    if (!res.ok) {
      throw new Error(
        "Unable to moderate this listing."
      );
    }

    return await res.json();
  };

  // Best-effort removal of photos that were uploaded for a listing that didn't get saved
  const cleanupUploads = async (paths) => {
    if (!paths || paths.length === 0) return;
    try {
      await supabase.storage.from("product-images").remove(paths);
    } catch (cleanupErr) {
      console.error("Could not clean up uploaded images:", cleanupErr);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (images.length === 0) return toast.error("Please upload at least one image!");
    if (!title.trim()) return toast.error("Please enter a product title!");
    if (title.trim().length > MAX_TITLE) {
      return toast.error(`Title is too long (max ${MAX_TITLE} characters).`);
    }
    if (!categoryId) return toast.error("Please select a category!");
    if (isOfficialOrgMerch) {
      if (!Number.isInteger(parsedStock) || parsedStock < 1 || parsedStock > MAX_STOCK) {
        return toast.error(`Stock must be between 1 and ${MAX_STOCK}.`);
      }
      const days = parseInt(durationDays, 10);
      if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
        return toast.error(`Listing duration must be between 1 and ${MAX_DAYS} days.`);
      }
    }
    if (!description.trim()) return toast.error("Please enter a description!");
    if (description.trim().length > MAX_DESCRIPTION) {
      return toast.error(`Description is too long (max ${MAX_DESCRIPTION} characters).`);
    }
    // Price: strip the commas, then validate
    const numericPrice = parseFloat(price.replace(/,/g, ""));
    if (isNaN(numericPrice) || numericPrice < 0) {
      return toast.error("Please enter a valid price!");
    }
    if (numericPrice > MAX_PRICE) {
      return toast.error("Price can't be more than ₱999,999,999.");
    }

    // A tag that was typed but not confirmed with Enter/comma is included instead of silently dropped
    let currentTags = tags;
    if (tagInput.trim()) {
      const { list, error } = tryAddTag(tags, tagInput);
      if (error) return toast.error(error);
      currentTags = list;
      setTags(list);
      setTagInput("");
    }

    setLoading(true);

    // Tracked outside the try block so the catch block can clean up after a partial failure
    const productId = crypto.randomUUID();
    const uploadedPaths = [];
    let productInserted = false;

    try {
      // 1. Run safety moderation check
      const moderation = await moderateListing(currentTags);

      // Bad tags: block the post and strip the offending tags so the seller can fix and retry
      const badTags = Array.isArray(moderation.bad_tags) ? moderation.bad_tags : [];
      const tagBlocked =
        moderation.tag_verdict === "rejected" ||
        (moderation.tag_verdict === "flagged" && badTags.length > 0);

      if (tagBlocked) {
        if (badTags.length > 0) {
          const lower = badTags.map((t) => t.toLowerCase());
          setTags((prev) => prev.filter((t) => !lower.includes(t.toLowerCase())));
        }
        toast.error(
          badTags.length > 0
            ? `These tags can't be used and were removed: ${badTags.map((t) => `#${t}`).join(", ")}. Please review your tags and post again.`
            : `One of your tags can't be used: ${moderation.reason || "it appears to break our posting rules"}`,
          { duration: 8000 }
        );
        setLoading(false);
        return;
      }

      if (moderation.verdict === "rejected") {
        const sourceText =
          moderation.sources?.includes("text") &&
            moderation.sources?.includes("image")
            ? "Your listing text and an uploaded image"
            : moderation.sources?.includes("text")
              ? "Your listing text"
              : "An uploaded image";

        toast.error(
          `${sourceText} cannot be used: ${moderation.reason ||
          "it appears to break our posting rules"
          }`,
          { duration: 8000 }
        );
        setLoading(false);
        return;
      }

      // A flagged listing always gets a moderation_flags row, merch included,
      // so a moderator sees it before the listing can go live.
      const isFlagged = moderation.verdict === "flagged";

      const uploadPromises = images.map(async (image) => {
        // Re-encode to JPEG so AVIF/HEIC/etc. never hit the bucket's MIME limits
        const jpeg = await compressToBlob(image, 1600, 0.85);
        const fileName = `${user.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.jpg`;
        const filePath = `listings/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, jpeg, { contentType: "image/jpeg" });

        if (uploadError) throw uploadError;
        uploadedPaths.push(filePath);

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        return publicUrl;
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      let finalCategoryId = categoryId;
      let finalTags = [
        ...new Set([
          ...currentTags.filter((t) => !RESERVED_TAGS.includes(t.toLowerCase())),
          listingType,
        ]),
      ];

      if (isOfficialOrgMerch) {
        if (!isVerifiedOrg) {
          throw new Error("Only verified organizations can create merchandise listings.");
        }
        finalTags.push("official-merch"); // the tag makes it merch; category is the seller's choice
      }

      // 2. Determine correct status: official merch is "pending" until payment is verified,
      // everything else is "flagged" if moderation flagged it, otherwise "active".
      let finalStatus = "active";
      if (isOfficialOrgMerch) {
        finalStatus = "pending";
      } else if (isFlagged) {
        finalStatus = "flagged";
      }

      const isLive = !isFlagged && !isOfficialOrgMerch;

      const productPayload = {
        id: productId,
        title: title.trim(),
        description: description.trim(),
        price: numericPrice,
        image_urls: uploadedUrls,
        seller_id: user.id,
        category_id: finalCategoryId,
        tags: finalTags,
        price_type: 'Fixed',
        is_available: isLive,
        is_published: isLive,
        status: finalStatus,
        stock_quantity: isOfficialOrgMerch ? parsedStock : null,
        listing_duration: isOfficialOrgMerch
          ? `${totalDays} ${totalDays === 1 ? "day" : "days"}`
          : null,
        listing_fee: calculatedFee
      };

      const { error: dbError } = await supabase
        .from("products")
        .insert([productPayload]);

      if (dbError) throw dbError;
      productInserted = true;

      // Record the moderation flag for ANY flagged listing (merch too)
      if (isFlagged) {
        const { error: flagError } = await supabase
          .from("moderation_flags")
          .insert([
            {
              user_id: user.id,
              product_id: productId,
              image_url: uploadedUrls[0] || null,
              verdict: "flagged",
              categories: moderation.categories || [],
              reason: moderation.reason || null,
            },
          ]);

        if (flagError) throw flagError;

        toast.warning(
          isOfficialOrgMerch
            ? "Your merchandise was flagged for moderator review. It will only go live once it is approved and payment is verified."
            : "Your listing was submitted for a moderator review due to safety flags. It will go live once approved.",
          { duration: 8000 }
        );
      }

      // Trigger payment instruction modal for merch drops, otherwise redirect to My Listings
      if (isOfficialOrgMerch) {
        setSubmittedMerch({
          title: title.trim(),
          fee: calculatedFee,
          stock: parsedStock,
          days: totalDays,
          image: uploadedUrls[0] || null,
          price: numericPrice,
        });
      } else {
        router.push("/mylistings");
        router.refresh();
      }

    } catch (error) {
      console.error("Submission error:", error);

      // Don't leave half-saved data behind. If the product row was already saved
      // (e.g. the flag record failed), try to remove it first; only delete its photos
      // if the row is really gone, so a surviving listing never ends up with broken images.
      if (productInserted) {
        const { error: deleteError } = await supabase
          .from("products")
          .delete()
          .eq("id", productId);
        if (!deleteError) await cleanupUploads(uploadedPaths);
      } else {
        await cleanupUploads(uploadedPaths);
      }

      toast.error(error.message || "Something went wrong.");
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
                onClick={() => {
                  setListingType("Rentals");
                  // Merch is sale-only, so turn it off when switching to rentals
                  setIsOfficialOrgMerch(false);
                }}
                className={`py-3 px-4 rounded-xl text-sm font-bold transition-all ${listingType === "Rentals" ? "bg-foreground text-background shadow-lg" : "text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"}`}
              >
                For Rent
              </button>
            </div>
          </section>

          {/* VERIFIED ORG EXCLUSIVE TOGGLE OPTION (sale listings only) */}
          {isVerifiedOrg && listingType === "Sale" && (
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
                        max={MAX_STOCK}
                        className="w-full bg-background border border-emerald-500/30 rounded-xl p-3 pl-10 text-foreground text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="e.g., 50 (max 999)"
                        value={stockQuantity}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                          setStockQuantity(digits === "" ? "" : String(Math.min(Number(digits), MAX_STOCK)));
                        }}
                      />
                    </div>

                    <div className="relative">
                      <label className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1.5 block">
                        Listing Duration (Days)
                      </label>
                      <Calendar className="absolute left-3.5 top-[38px] text-emerald-600 dark:text-emerald-400" size={16} />
                      <input
                        required={isOfficialOrgMerch}
                        type="text"
                        inputMode="numeric"
                        className="w-full bg-background border border-emerald-500/30 rounded-xl p-3 pl-10 text-foreground text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder={`Number of days (1–${MAX_DAYS})`}
                        value={durationDays}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 2);
                          setDurationDays(digits === "" ? "" : String(Math.min(Number(digits), MAX_DAYS)));
                        }}
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
                  <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" multiple onChange={handleImageChange} />
                </label>
              )}

              {previewUrls.map((url, index) => (
                <div key={url} className="relative aspect-square rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 group shadow-sm">
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


          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 relative">
              <label className="text-sm font-bold text-neutral-600 dark:text-neutral-400 mb-2 block">Product Title</label>
              <Tag className="absolute left-4 top-[46px] text-neutral-400" size={18} />
              <input
                required
                maxLength={MAX_TITLE}
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
              <label className="text-sm font-bold text-neutral-600 dark:text-neutral-400 mb-2 flex items-center justify-between">
                <span>Price</span>
                {listingType === "Rentals" && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-extrabold uppercase tracking-wider">
                    Rental Rate (/ Day)
                  </span>
                )}
              </label>
              <span className="absolute left-4 top-[46px] text-neutral-400 font-bold">₱</span>
              <input
                required
                type="text"
                inputMode="decimal"
                className="w-full bg-background border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 pl-10 text-foreground outline-none focus:ring-2 focus:ring-foreground transition-all placeholder:text-neutral-400"
                placeholder={listingType === "Rentals" ? "0.00 (Per Day)" : "0.00"}
                value={price}
                onChange={(e) => setPrice(formatPrice(e.target.value))}
              />
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
                {isOfficialOrgMerch && (
                  <span className="flex items-center gap-1 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-lg text-xs font-bold border border-emerald-600">
                    <ShieldCheck size={12} /> #official-merch
                  </span>
                )}
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
                  maxLength={MAX_TAG_LENGTH}
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
            <div className="relative md:col-span-2">
              <label className="text-sm font-bold text-neutral-600 dark:text-neutral-400 mb-2 block">Description</label>
              <FileText className="absolute left-4 top-[46px] text-neutral-400" size={18} />
              <textarea
                rows="7"
                required
                className="w-full bg-background border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 pl-12 text-foreground outline-none focus:ring-2 focus:ring-foreground transition-all resize-none placeholder:text-neutral-400"
                placeholder="Tell buyers more about your product..."
                value={description}
                maxLength={MAX_DESCRIPTION}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="mt-1.5 text-right text-[11px] text-neutral-500">
                {description.length} / {MAX_DESCRIPTION}
              </p>
            </div>

            {/* SUBMIT */}
            <div className="pt-6 md:col-span-2 flex justify-center">
              <button
                type="submit"
                disabled={loading || images.length === 0}
                className="w-full max-w-xl bg-foreground text-background border border-foreground font-bold py-5 rounded-2xl flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50 cursor-pointer"
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
          </div>
        </form>

        {/* PAYMENT INSTRUCTIONS MODAL */}
        {submittedMerch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background border border-neutral-200 dark:border-neutral-800 p-6 md:p-8 rounded-3xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-6">

              <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-4">
                <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
                  <CreditCard size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Payment Required</h3>
                  <p className="text-xs text-neutral-500">Merchandise Drop Verification</p>
                </div>
              </div>

              {/* The item being listed */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Your Item:</p>
                <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 p-3">
                  {submittedMerch.image ? (
                    <img
                      src={submittedMerch.image}
                      alt=""
                      className="w-16 h-16 rounded-xl object-cover shrink-0 border border-neutral-200 dark:border-neutral-800"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/15 text-amber-500">
                      <ShoppingBag size={24} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground line-clamp-2">{submittedMerch.title}</p>
                    <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                      Selling price:{" "}
                      <span className="font-bold text-foreground">{formatPeso(submittedMerch.price)}</span>
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
                      <span className="inline-flex items-center gap-1">
                        <Layers size={12} />
                        <span className="font-bold text-foreground">{submittedMerch.stock}</span>{" "}
                        {submittedMerch.stock === 1 ? "unit" : "units"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={12} />
                        <span className="font-bold text-foreground">
                          {submittedMerch.days} {submittedMerch.days === 1 ? "day" : "days"}
                        </span>
                      </span>
                    </div>
                    <span className="mt-1.5 inline-block text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      Awaiting payment
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-1 text-xs">
                <p className="font-bold text-amber-700 dark:text-amber-400">Total Listing Fee to Settle:</p>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-300">₱{submittedMerch.fee.toFixed(2)}</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  ({submittedMerch.days} {submittedMerch.days === 1 ? "day" : "days"} duration fee)
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <p className="font-bold uppercase text-neutral-400 tracking-wider">Payment Instructions:</p>

                <div className="p-3 bg-neutral-100 dark:bg-neutral-900 rounded-xl space-y-1 border border-neutral-200 dark:border-neutral-800">
                  <p className="font-bold text-foreground">GCash Account:</p>
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">09277549105</p>
                  <p className="text-[11px] text-neutral-500">OLFU Marketplace Admin</p>
                </div>

                <div className="space-y-1.5 text-neutral-600 dark:text-neutral-300">
                  <p className="font-bold text-foreground">Steps after paying:</p>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                    <li>Take a screenshot of your GCash payment receipt.</li>
                    <li>Send an email to <strong className="text-foreground">olfumarketplace@gmail.com</strong>.</li>
                    <li>Include your item title (<span className="italic">&quot;{submittedMerch.title}&quot;</span>) and attach the receipt screenshot.</li>
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