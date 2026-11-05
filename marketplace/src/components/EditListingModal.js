"use client";

import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { Edit3, X, Tag, PhilippinePeso, FileText, Layers, Loader2, ShieldCheck, ImagePlus } from "lucide-react";
import { isMerch } from "@/lib/merch";
import { getListingState } from "@/lib/listingStatus";
import { friendlyListingError } from "@/lib/listingErrors";
import { useConfirm } from "@/components/ConfirmDialog";

const MAX_DESCRIPTION = 1000;
const MAX_STOCK = 999;
const MAX_PRICE = 100000;
const MAX_PHOTOS = 10;
const MAX_PHOTO_MB = 10;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_PHOTO_EXTS = ["jpg", "jpeg", "png", "webp"];

// Shrinks a photo to a JPEG before upload (same sizes the create-listing page uses)
const compressToBlob = (file, maxSize = 1600, quality = 0.85) =>
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

export default function EditListingModal({ product, onClose, onSaved }) {
    const merch = isMerch(product);
    const expired = getListingState(product) === "expired";
    const canEditStock = merch && !expired;
    const currentStock = product.stock_quantity ?? 0;

    const [askConfirm, confirmDialog] = useConfirm();
    const [saving, setSaving] = useState(false);
    const [photos, setPhotos] = useState(Array.isArray(product.image_urls) ? product.image_urls : []);
    const [removingUrl, setRemovingUrl] = useState(null);
    const [adding, setAdding] = useState(false);
    const [photosChanged, setPhotosChanged] = useState(false);
    const photosEditable = ["active", "unavailable", "expired"].includes(product.status);
    const canRemovePhotos = photosEditable && photos.length > 1;
    const canAddPhotos = photosEditable && photos.length < MAX_PHOTOS;

    const handleRemovePhoto = async (url) => {
        if (removingUrl || saving || adding) return;
        const ok = await askConfirm({
            title: "Remove this photo?",
            message: "It comes off your listing right away. You don't need to press Save Changes.",
            confirmLabel: "Remove photo",
            tone: "danger",
        });
        if (!ok) return;

        setRemovingUrl(url);
        try {
            const res = await fetch("/api/remove-listing-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId: product.id, imageUrl: url }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Couldn't remove the photo.");
            setPhotos((prev) => prev.filter((u) => u !== url));
            setPhotosChanged(true);
            toast.success("Photo removed.");
        } catch (err) {
            toast.error(err.message || "Couldn't remove the photo.");
        } finally {
            setRemovingUrl(null);
        }
    };

    // Adds one photo. The server checks it (type, safety, duplicates) before it is attached.
    const handleAddPhoto = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file || adding || saving || removingUrl) return;

        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!ALLOWED_PHOTO_TYPES.includes(file.type) || !ALLOWED_PHOTO_EXTS.includes(ext)) {
            toast.error(`"${file.name}" isn't allowed. Please use a JPG, PNG or WEBP photo.`);
            return;
        }
        if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
            toast.error(`"${file.name}" is larger than ${MAX_PHOTO_MB} MB.`);
            return;
        }

        setAdding(true);
        try {
            const jpeg = await compressToBlob(file);

            const send = async (confirmSimilar) => {
                const fd = new FormData();
                fd.append("productId", product.id);
                fd.append("image", jpeg, "photo.jpg");
                if (confirmSimilar) fd.append("confirmSimilar", "true");
                const res = await fetch("/api/add-listing-image", { method: "POST", body: fd });
                const data = await res.json().catch(() => ({}));
                return { res, data };
            };

            let { res, data } = await send(false);

            // The photo looks like one on another listing of yours: ask, then retry if they agree
            if (res.status === 409 && data.code === "similar_own_listing") {
                const ok = await askConfirm({
                    title: "Looks like another listing of yours",
                    message: `This photo looks like one on your listing "${data.title}". If this is a different item (for example another color), you can add it anyway.`,
                    confirmLabel: "Add anyway",
                });
                if (!ok) return; // nothing was uploaded; the finally block resets the button
                ({ res, data } = await send(true));
            }

            if (!res.ok) throw new Error(data.error || "Couldn't add the photo.");

            const nextPhotos = [...photos, data.imageUrl];
            setPhotos(nextPhotos);

            if (data.flagged) {
                // The listing is now hidden for review, so close the editor with its new state
                toast.warning("Safety review required", {
                    description: "Your new photo triggered our content check. The listing is hidden until a moderator approves it.",
                    duration: 10000,
                });
                onSaved({ ...product, image_urls: nextPhotos, status: "flagged", is_available: false });
                return;
            }

            setPhotosChanged(true);
            toast.success("Photo added.");
        } catch (err) {
            toast.error(err.message || "Couldn't add the photo.");
        } finally {
            setAdding(false);
        }
    };

    // If photos were removed or added, tell the parent so its list refreshes even when the form isn't saved
    const handleClose = () => {
        if (photosChanged) onSaved({ ...product, image_urls: photos });
        else onClose();
    };
    const [form, setForm] = useState({
        title: product.title,
        price: product.price,
        description: product.description || "",
        stock_quantity: currentStock,
    });

    const handleSave = async (e) => {
        e.preventDefault();
        if (adding || removingUrl) return;
        if (form.description.trim().length > MAX_DESCRIPTION) {
            toast.error(`Description is too long (max ${MAX_DESCRIPTION} characters).`);
            return;
        }
        const priceNum = Number(form.price);
        if (form.price === "" || !Number.isFinite(priceNum) || priceNum < 0 || priceNum > MAX_PRICE) {
            toast.error(`Price must be between 0 and ${MAX_PRICE.toLocaleString()}.`);
            return;
        }
        if (canEditStock) {
            const stockNum = parseInt(form.stock_quantity, 10);
            if (!Number.isInteger(stockNum) || stockNum < 0 || stockNum > MAX_STOCK) {
                toast.error(`Stock must be between 0 and ${MAX_STOCK}.`);
                return;
            }
        }
        setSaving(true);
        try {
            // 1. Only re-run moderation if the title or description actually changed
            const textChanged =
                form.title.trim() !== (product.title || "").trim() ||
                form.description.trim() !== (product.description || "").trim();

            let moderation = { verdict: "clean" };
            if (textChanged) {
                const fd = new FormData();
                fd.append("title", form.title.trim());
                fd.append("description", form.description.trim());
                const modRes = await fetch("/api/moderate-listing", { method: "POST", body: fd });
                if (modRes.status === 401) throw new Error("Your session expired. Please log in again.");
                if (!modRes.ok) throw new Error("Couldn't check your edits right now. Please try again.");
                moderation = await modRes.json();

                if (moderation.verdict === "rejected") {
                    toast.error(`Update blocked: ${moderation.reason || "it violates our posting guidelines."}`, { duration: 8000 });
                    return;
                }
            }
            const needsReview = moderation.verdict === "flagged";

            // 2. Tags: keep everything as-is (official-merch is never touched here)
            let tags = Array.isArray(product.tags) ? [...product.tags] : [];
            tags = tags.filter((t) => t !== "Flagged"); // flagged state lives in status, not tags


            // 3. Stock, availability, status
            const stock = canEditStock ? parseInt(form.stock_quantity) || 0 : currentStock;
            const canBeLive = !expired && !!product.expires_at && ["active", "unavailable"].includes(product.status);
            const wasFlagged = product.status === "flagged";

            let is_available, status;
            if (needsReview) {
                is_available = false;
                status = "flagged";
            } else if (product.status === "rejected") {
                // still rejected: only the Resubmit button moves it forward
                is_available = false;
                status = "rejected";
            } else if (wasFlagged) {
                // merch goes back to the admin queue, everything else goes live
                is_available = !merch;
                status = merch ? "pending" : "active";
            } else if (merch) {
                is_available = stock > 0 && canBeLive;
                status = is_available ? "active" : expired || product.status === "expired" ? "expired" : "unavailable";
            } else {
                is_available = product.is_available;
                status = product.status;
            }

            const changes = {
                title: form.title.trim(),
                price: Math.round(priceNum * 100) / 100,
                description: form.description.trim(),
                tags,
                is_available,
                status,
                ...(canEditStock ? { stock_quantity: stock } : {}),
            };

            const { error } = await supabase.from("products").update(changes).eq("id", product.id);
            if (error) throw error;

            if (needsReview) {
                await supabase.from("moderation_flags").insert([{
                    user_id: product.seller_id,
                    product_id: product.id,
                    image_url: photos[0] || null,
                    verdict: "flagged",
                    categories: moderation.categories || [],
                    reason: moderation.reason || "Flagged during edit update",
                }]);
                toast.warning("Safety review required", {
                    description: "Your edits triggered our content check. The listing is hidden until a moderator approves it.",
                    duration: 10000,
                });
            } else {
                toast.success("Listing updated.");
            }

            onSaved(photosChanged ? { ...changes, image_urls: photos } : changes);
        } catch (err) {
            console.error("Update error:", err);
            toast.error("Failed to update: " + friendlyListingError(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-background border border-border w-full max-w-lg rounded-3xl shadow-2xl p-6 md:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center border-b border-border pb-4">
                        <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2.5 text-foreground">
                            <div className="p-2 bg-foreground/10 text-foreground rounded-xl"><Edit3 size={18} /></div>
                            Edit Product Details
                        </h3>
                        <button type="button" onClick={handleClose} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSave} className="space-y-4">
                        {merch && (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-3 py-1 rounded-lg text-xs font-bold border border-emerald-600">
                                <ShieldCheck size={12} /> #official-merch (locked)
                            </span>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><Tag size={14} /> Product Title</label>
                            <input required className="w-full bg-muted/40 border border-border rounded-xl p-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-foreground transition-all"
                                value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><PhilippinePeso size={14} /> Price (₱)</label>
                                <input required type="text" inputMode="decimal" autoComplete="off"
                                    className="w-full bg-muted/40 border border-border rounded-xl p-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-foreground transition-all"
                                    value={form.price}
                                    onChange={(e) => {
                                        let v = e.target.value.replace(/[^\d.]/g, "");
                                        const [whole, ...rest] = v.split(".");
                                        v = rest.length ? `${whole.slice(0, 6)}.${rest.join("").slice(0, 2)}` : whole.slice(0, 6);
                                        setForm({ ...form, price: v });
                                    }} />
                            </div>

                            {canEditStock && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Layers size={14} /> Total Stock Units Left (max 999)</label>
                                    <input required type="text" inputMode="numeric" autoComplete="off"
                                        className="w-full bg-muted/40 border border-emerald-500/30 rounded-xl p-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                        value={form.stock_quantity}
                                        onChange={(e) => {
                                            const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                                            setForm({
                                                ...form,
                                                stock_quantity: digits === "" ? "" : String(Math.min(Number(digits), MAX_STOCK)),
                                            });
                                        }} />
                                </div>
                            )}
                            {merch && expired && (
                                <p className="text-[11px] text-muted-foreground sm:col-span-2">
                                    This drop has expired, so stock can&apos;t be edited. Use Renew &amp; Pay to restock.
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground flex items-center gap-1"><FileText size={14} /> Description</label>
                            <textarea rows="4" className="w-full bg-muted/40 border border-border rounded-xl p-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-foreground transition-all resize-none"
                                value={form.description} maxLength={MAX_DESCRIPTION} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                            <p className="text-right text-[11px] text-muted-foreground">
                                {form.description.length} / {MAX_DESCRIPTION}
                            </p>
                        </div>

                        {photos.length > 0 && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-muted-foreground">Photos ({photos.length} / {MAX_PHOTOS})</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {photos.map((url, i) => (
                                        <div key={url} className="relative aspect-square rounded-xl overflow-hidden border border-border">
                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                            {i === 0 && (
                                                <span className="absolute top-1 left-1 bg-foreground text-background text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">Cover</span>
                                            )}
                                            {canRemovePhotos && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemovePhoto(url)}
                                                    disabled={!!removingUrl || adding}
                                                    className="absolute top-1 right-1 bg-background/90 p-1 rounded-full text-red-500 shadow-md disabled:opacity-50"
                                                >
                                                    {removingUrl === url ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                                                </button>
                                            )}
                                        </div>
                                    ))}

                                    {canAddPhotos && (
                                        <label
                                            className={`aspect-square flex flex-col items-center justify-center gap-0.5 border-2 border-dashed border-border rounded-xl transition-colors ${adding || saving || removingUrl ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-muted"}`}
                                        >
                                            {adding ? (
                                                <Loader2 size={18} className="animate-spin text-muted-foreground" />
                                            ) : (
                                                <ImagePlus size={18} className="text-muted-foreground" />
                                            )}
                                            <span className="text-[9px] font-bold uppercase text-muted-foreground">
                                                {adding ? "Checking" : "Add"}
                                            </span>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/jpeg,image/png,image/webp"
                                                disabled={adding || saving || !!removingUrl}
                                                onChange={handleAddPhoto}
                                            />
                                        </label>
                                    )}
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    {photosEditable
                                        ? "Photos save as soon as you add or remove them, so you don't need to press Save Changes. New photos are checked first, which can take a few seconds. A listing keeps at least one photo."
                                        : "Photos can't be changed while this listing is under review."}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={handleClose} className="flex-1 py-3 bg-muted text-foreground rounded-2xl text-xs font-black uppercase tracking-wider hover:opacity-80 transition-opacity">Cancel</button>
                            <button type="submit" disabled={saving || adding} className="flex-1 py-3 bg-foreground text-background rounded-2xl text-xs font-black uppercase tracking-wider hover:opacity-90 transition-opacity shadow-md flex items-center justify-center gap-2 disabled:opacity-60">
                                {saving ? <Loader2 className="animate-spin" size={16} /> : "Save Changes"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            {confirmDialog}
        </>
    );
}