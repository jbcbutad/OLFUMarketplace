"use client";

import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { Edit3, X, Tag, PhilippinePeso, FileText, Layers, Loader2, ShieldCheck } from "lucide-react";
import { isMerch } from "@/lib/merch";
import { getListingState } from "@/lib/listingStatus";

export default function EditListingModal({ product, onClose, onSaved }) {
    const merch = isMerch(product);
    const expired = getListingState(product) === "expired";
    const canEditStock = merch && !expired;
    const currentStock = product.stock_quantity ?? 0;

    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        title: product.title,
        price: product.price,
        description: product.description || "",
        stock_quantity: currentStock,
    });

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            // 1. Re-run moderation on the edited text + cover photo
            const fd = new FormData();
            fd.append("title", form.title.trim());
            fd.append("description", form.description.trim());
            if (product.image_urls?.[0]) {
                try {
                    const blob = await (await fetch(product.image_urls[0])).blob();
                    fd.append("images", blob, "existing-photo.jpg");
                } catch (err) {
                    console.warn("Could not fetch existing image for re-moderation:", err);
                }
            }
            const modRes = await fetch("/api/moderate-listing", { method: "POST", body: fd });
            if (modRes.status === 401) throw new Error("Your session expired. Please log in again.");
            const moderation = await modRes.json();

            if (moderation.verdict === "rejected") {
                toast.error(`Update blocked: ${moderation.reason || "it violates our posting guidelines."}`, { duration: 8000 });
                return;
            }
            const needsReview = moderation.verdict === "flagged";

            // 2. Tags: keep everything as-is (official-merch is never touched here)
            let tags = Array.isArray(product.tags) ? [...product.tags] : [];
            if (needsReview && !tags.includes("Flagged")) tags.push("Flagged");
            if (!needsReview) tags = tags.filter((t) => t !== "Flagged");

            // 3. Stock, availability, status
            const stock = canEditStock ? parseInt(form.stock_quantity) || 0 : currentStock;
            const canBeLive = !expired && !!product.expires_at && ["active", "unavailable"].includes(product.status);
            const wasFlagged = product.status === "flagged";

            let is_available, status;
            if (needsReview) {
                is_available = false;
                status = "flagged";
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
                price: parseFloat(form.price),
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
                    image_url: product.image_urls?.[0] || null,
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

            onSaved(changes);
        } catch (err) {
            console.error("Update error:", err);
            toast.error("Failed to update: " + (err.message || "Unknown error"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background border border-border w-full max-w-lg rounded-3xl shadow-2xl p-6 md:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-border pb-4">
                    <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2.5 text-foreground">
                        <div className="p-2 bg-foreground/10 text-foreground rounded-xl"><Edit3 size={18} /></div>
                        Edit Product Details
                    </h3>
                    <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors">
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
                            <input required type="number" step="0.01" className="w-full bg-muted/40 border border-border rounded-xl p-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-foreground transition-all"
                                value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                        </div>

                        {canEditStock && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Layers size={14} /> Total Stock Units Left</label>
                                <input required type="number" min="0" className="w-full bg-muted/40 border border-emerald-500/30 rounded-xl p-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                    value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
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
                            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-3 bg-muted text-foreground rounded-2xl text-xs font-black uppercase tracking-wider hover:opacity-80 transition-opacity">Cancel</button>
                        <button type="submit" disabled={saving} className="flex-1 py-3 bg-foreground text-background rounded-2xl text-xs font-black uppercase tracking-wider hover:opacity-90 transition-opacity shadow-md flex items-center justify-center gap-2">
                            {saving ? <Loader2 className="animate-spin" size={16} /> : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}