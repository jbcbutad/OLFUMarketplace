"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { Edit3, Trash2, ChevronDown, AlertTriangle, Loader2, X, Layers, CheckCircle, Tag, PhilippinePeso, FileText, PlusCircle, RefreshCcw } from "lucide-react";
import MarkAsTransactedModal from "@/components/MarkAsTransactedModal";
import RelistButton from "@/components/RelistButton";
import { getListingState } from "@/lib/listingStatus";

export default function SellerControls({ product, currentUserId }) {
    const router = useRouter();
    const [openDropdown, setOpenDropdown] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isTransactOpen, setIsTransactOpen] = useState(false);
    const [targetStatus, setTargetStatus] = useState("unavailable");
    const [isProcessing, setIsProcessing] = useState(false);

    // Restock Popup States
    const [isRestockOpen, setIsRestockOpen] = useState(false);
    const [restockQtyInput, setRestockQtyInput] = useState("10");

    // Strict Merchandise Check
    const isMerchandise = product.categories?.name === "Merchandise";
    const currentStock = product.stock_quantity ?? 0;
    const [deductQty, setDeductQty] = useState(1);

    const listingState = getListingState(product);
    const isActuallyExpired = listingState === "expired";

    const [editForm, setEditForm] = useState({
        title: product.title,
        price: product.price,
        description: product.description || "",
        condition: product.condition || "Good",
        course_code: product.course_code || "",
        stock_quantity: currentStock,
    });

    const isFlagged = product.status === "flagged";
    const isPendingAdmin = product.status === "pending";
    const isExpiredTag = isActuallyExpired;
    const isUnavailable = !product.is_available || isExpiredTag;

    let statusLabel = "Available";
    let statusDot = "bg-emerald-500";
    if (isFlagged) {
        statusLabel = "Flagged / Review";
        statusDot = "bg-rose-500";
    } else if (isExpiredTag) {
        statusLabel = isMerchandise ? "Expired Drop" : "Expired";
        statusDot = "bg-amber-500";
    } else if (isUnavailable) {
        statusLabel = "Unavailable";
        statusDot = "bg-neutral-400";
    }
    const statusBadgeStyle = "bg-[var(--surface)] text-foreground border-[var(--line)]";

    const handleStatusChange = async (choice) => {
        setOpenDropdown(false);

        if (choice === "available") {
            // BLOCK FLAGGED ITEMS FROM BEING MADE AVAILABLE
            if (isFlagged) {
                toast.error("This listing cannot be made available because it is flagged under safety review by moderators.");
                return;
            }

            if (product.status === "rejected") {
                toast.error("This listing was rejected by an admin and cannot be made available.");
                return;
            }

            if (isActuallyExpired) {
                if (isMerchandise) {
                    toast.error("This drop has expired. Use Renew & Pay.");
                    return;
                }
                const { error } = await supabase.rpc("relist_product", { p_product_id: product.id });
                if (error) toast.error(error.message);
                router.refresh();
                return;
            }

            if (isMerchandise) {
                // A merch drop with no expiry date was never approved with a duration
                if (!product.expires_at) {
                    toast.error("This drop has no active duration, so it can't be made available. Please contact an admin.");
                    return;
                }

                if (currentStock > 0) {
                    setIsProcessing(true);
                    let cleanTags = Array.isArray(product.tags) ? product.tags.filter((t) => t !== "Expired") : [];
                    await supabase
                        .from("products")
                        .update({ is_available: true, status: "active", tags: cleanTags })
                        .eq("id", product.id);
                    setIsProcessing(false);
                    router.refresh();
                    return;
                }

                setIsRestockOpen(true);
                return;
            }

            let updatedTags = Array.isArray(product.tags) ? product.tags.filter((t) => t !== "Expired") : [];
            await supabase.from("products").update({ is_available: true, status: "active", tags: updatedTags }).eq("id", product.id);
            router.refresh();
        } else {
            setTargetStatus(choice);
            setIsTransactOpen(true);
        }
    };

    const handleConfirmRestock = async (e) => {
        e.preventDefault();
        if (isActuallyExpired) {
            toast.error("Cannot restock an expired merchandise drop. Please renew your listing.");
            return;
        }

        const addedStock = parseInt(restockQtyInput);
        if (isNaN(addedStock) || addedStock <= 0) {
            toast.error("Please enter a valid stock quantity greater than 0.");
            return;
        }

        setIsProcessing(true);
        try {
            let cleanTags = Array.isArray(product.tags) ? product.tags.filter((t) => t !== "Expired") : [];
            const { error } = await supabase
                .from("products")
                .update({
                    stock_quantity: addedStock,
                    is_available: true,
                    status: "active",
                    tags: cleanTags
                })
                .eq("id", product.id);

            if (error) throw error;
            setIsRestockOpen(false);
            router.refresh();
        } catch (err) {
            toast.error("Failed to restock: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTriggerMerchSale = () => {
        if (isActuallyExpired) {
            toast.error("This listing has expired. You cannot record sales until it is renewed.");
            return;
        }

        const qtyToSubtract = parseInt(deductQty) || 1;
        if (qtyToSubtract > currentStock) {
            toast.error(`Cannot deduct ${qtyToSubtract} units. Only ${currentStock} units left in stock.`);
            return;
        }

        setTargetStatus("unavailable");
        setIsTransactOpen(true);
    };

    const confirmUpdate = async (e) => {
        e.preventDefault();
        setIsProcessing(true);
        let updatedTags = Array.isArray(product.tags) ? [...product.tags] : [];

        const updatedStock = isMerchandise ? parseInt(editForm.stock_quantity) || 0 : currentStock;
        const canBeLive = !isActuallyExpired && !!product.expires_at && ["active", "unavailable"].includes(product.status);
        const shouldBeAvailable = isMerchandise ? updatedStock > 0 && canBeLive : product.is_available;
        const nextStatus = shouldBeAvailable
            ? "active"
            : isActuallyExpired || product.status === "expired"
                ? "expired"
                : "unavailable";

        const { error } = await supabase
            .from("products")
            .update({
                title: editForm.title.trim(),
                price: parseFloat(editForm.price),
                description: editForm.description.trim(),
                condition: editForm.condition,
                course_code: editForm.course_code,
                stock_quantity: updatedStock,
                is_available: shouldBeAvailable,
                status: nextStatus,
                tags: updatedTags,
            })
            .eq("id", product.id);

        setIsProcessing(false);
        if (!error) {
            setIsEditOpen(false);
            router.refresh();
        } else {
            toast.error("Failed to update: " + error.message);
        }
    };

    const confirmDelete = async () => {
        setIsProcessing(true);
        const { error } = await supabase.from("products").delete().eq("id", product.id);
        setIsProcessing(false);
        if (!error) {
            router.push("/mylistings");
        }
    };

    // Early return if flagged by system
    if (isFlagged) {
        return (
            <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl my-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                    <span className="text-xs font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                        Flagged by Moderation System — Awaiting Review
                    </span>
                </div>
                <span className="px-3 py-1 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg">
                    Flagged
                </span>
            </div>
        );
    }

    // Early return if pending admin approval
    if (isPendingAdmin) {
        return (
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl my-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                    <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Awaiting Admin Approval & Payment Verification
                    </span>
                </div>
                <span className="px-3 py-1 bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest rounded-lg">
                    Pending
                </span>
            </div>
        );
    }

    return (
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl p-4 my-4 space-y-4">
            {/* Header: title left, status right */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                    Listing Management
                    {isMerchandise && (
                        <span className="ml-2 font-bold normal-case tracking-normal text-muted-foreground">
                            · {currentStock} in stock
                        </span>
                    )}
                </h3>

                {isExpiredTag ? (
                    <span className="px-3 py-1.5 rounded-xl text-xs font-black uppercase border flex items-center gap-2 bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/40">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        {statusLabel}
                    </span>
                ) : (
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setOpenDropdown(!openDropdown)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border flex items-center gap-2 cursor-pointer hover:bg-muted transition-colors ${statusBadgeStyle}`}
                        >
                            <span className={`w-2 h-2 rounded-full ${statusDot}`} />
                            <span>{statusLabel}</span>
                            <ChevronDown size={14} />
                        </button>

                        {openDropdown && (
                            <div className="absolute right-0 mt-2 w-36 bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-xl py-1 z-30">
                                <button
                                    type="button"
                                    onClick={() => handleStatusChange("available")}
                                    className="w-full text-left px-3 py-2 text-xs font-bold text-foreground hover:bg-muted uppercase"
                                >
                                    Available
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleStatusChange("unavailable")}
                                    className="w-full text-left px-3 py-2 text-xs font-bold text-foreground hover:bg-muted uppercase"
                                >
                                    Unavailable
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* One-line explanation when expired */}
            {isExpiredTag && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                    {isMerchandise
                        ? "This drop has expired and is hidden from buyers. Renew it to set a new duration; it goes live again once an admin approves the payment."
                        : "This listing has expired and is hidden from buyers. Relist it for free to put it back up."}
                </p>
            )}

            {/* Action row */}
            <div className="flex items-center gap-2 flex-wrap">
                {isExpiredTag &&
                    (isMerchandise ? (
                        <button
                            onClick={() => router.push(`/mylistings?renew=${product.id}`)}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <RefreshCcw size={13} /> Renew & Pay
                        </button>
                    ) : (
                        <RelistButton
                            productId={product.id}
                            label="Relist (Free)"
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                        />
                    ))}

                <button
                    onClick={() => setIsEditOpen(true)}
                    className="px-3.5 py-2 bg-transparent text-foreground border border-[var(--line)] rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-muted transition-colors cursor-pointer"
                >
                    <Edit3 size={13} /> Edit
                </button>
                <button
                    onClick={() => setIsDeleteOpen(true)}
                    className="px-3.5 py-2 bg-transparent text-red-600 dark:text-red-400 border border-red-500/40 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                    <Trash2 size={13} /> Delete
                </button>
            </div>

            {/* Merchandise Quantity Deduction Box */}
            {isMerchandise && product.is_available && currentStock > 0 && !isExpiredTag && (
                <div className="pt-4 border-t border-[var(--line)] space-y-2">
                    <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle size={13} className="text-emerald-600 dark:text-emerald-400" /> Record sale & deduct stock ({currentStock} left)
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min="1"
                            max={currentStock}
                            value={deductQty}
                            onChange={(e) => setDeductQty(e.target.value)}
                            className="w-20 bg-transparent border border-[var(--line)] rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none"
                        />
                        <button
                            onClick={handleTriggerMerchSale}
                            disabled={currentStock <= 0}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            <CheckCircle size={14} /> Record Sale
                        </button>
                    </div>
                </div>
            )}

            {/* Custom Restock Modal Popup */}
            {isRestockOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-background border border-border w-full max-w-md rounded-3xl shadow-2xl p-6 md:p-8 space-y-6">
                        <div className="flex justify-between items-center border-b border-border pb-4">
                            <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2.5 text-foreground">
                                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                                    <PlusCircle size={18} />
                                </div>
                                Restock Sold-Out Merch
                            </h3>
                            <button onClick={() => setIsRestockOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                This merchandise item is currently sold out (<strong className="text-foreground">0 units left</strong>). Enter how many new stock units are available to bring your drop back live:
                            </p>

                            <form onSubmit={handleConfirmRestock} className="space-y-4 pt-2">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-foreground flex items-center gap-1">
                                        <Layers size={14} className="text-amber-500" /> New Stock Quantity
                                    </label>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        className="w-full bg-muted/40 border border-border rounded-xl p-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-foreground transition-all font-bold"
                                        value={restockQtyInput}
                                        onChange={(e) => setRestockQtyInput(e.target.value)}
                                        placeholder="e.g. 50"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsRestockOpen(false)}
                                        className="flex-1 py-3 bg-muted text-foreground rounded-2xl text-xs font-black uppercase tracking-wider hover:opacity-80 transition-opacity"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isProcessing}
                                        className="flex-1 py-3 bg-foreground text-background rounded-2xl text-xs font-black uppercase tracking-wider hover:opacity-90 transition-opacity shadow-md flex items-center justify-center gap-2"
                                    >
                                        {isProcessing ? <Loader2 className="animate-spin" size={16} /> : "Restock & Go Live"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Transact Modal */}
            {isTransactOpen && (
                <MarkAsTransactedModal
                    productId={product.id}
                    sellerId={currentUserId}
                    isRental={false}
                    isMerchandise={isMerchandise}
                    maxStock={currentStock}
                    deductAmount={isMerchandise ? parseInt(deductQty) || 1 : 1}
                    targetStatus={targetStatus}
                    onClose={() => setIsTransactOpen(false)}
                    onSuccess={() => {
                        router.refresh();
                    }}
                />
            )}

            {/* Edit Product Modal */}
            {isEditOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-background border border-border w-full max-w-lg rounded-3xl shadow-2xl p-6 md:p-8 space-y-6">
                        <div className="flex justify-between items-center border-b border-border pb-4">
                            <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2.5 text-foreground">
                                <div className="p-2 bg-foreground/10 text-foreground rounded-xl">
                                    <Edit3 size={18} />
                                </div>
                                Edit Product Details
                            </h3>
                            <button onClick={() => setIsEditOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={confirmUpdate} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                                    <Tag size={14} /> Product Title
                                </label>
                                <input
                                    required
                                    className="w-full bg-muted/40 border border-border rounded-xl p-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-foreground transition-all"
                                    value={editForm.title}
                                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                    placeholder="Enter product title..."
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                                        <PhilippinePeso size={14} /> Price (₱)
                                    </label>
                                    <input
                                        required
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-muted/40 border border-border rounded-xl p-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-foreground transition-all"
                                        value={editForm.price}
                                        onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>

                                {isMerchandise && (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                            <Layers size={14} /> Total Stock Units Left
                                        </label>
                                        <input
                                            required
                                            type="number"
                                            min="0"
                                            className="w-full bg-muted/40 border border-emerald-500/30 rounded-xl p-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                            value={editForm.stock_quantity}
                                            onChange={(e) => setEditForm({ ...editForm, stock_quantity: e.target.value })}
                                            placeholder="Enter total stock..."
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                                    <FileText size={14} /> Description
                                </label>
                                <textarea
                                    rows="4"
                                    className="w-full bg-muted/40 border border-border rounded-xl p-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-foreground transition-all resize-none"
                                    value={editForm.description}
                                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                    placeholder="Provide details about your listing..."
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEditOpen(false)}
                                    className="flex-1 py-3 bg-muted text-foreground rounded-2xl text-xs font-black uppercase tracking-wider hover:opacity-80 transition-opacity"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isProcessing}
                                    className="flex-1 py-3 bg-foreground text-background rounded-2xl text-xs font-black uppercase tracking-wider hover:opacity-90 transition-opacity shadow-md flex items-center justify-center gap-2"
                                >
                                    {isProcessing ? <Loader2 className="animate-spin" size={16} /> : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {isDeleteOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-background border border-border p-6 rounded-3xl max-w-sm w-full text-center">
                        <AlertTriangle className="text-red-600 dark:text-red-400 mx-auto mb-3" size={32} />
                        <h3 className="text-lg font-black uppercase mb-2 text-foreground">Delete Product?</h3>
                        <p className="text-muted-foreground text-xs mb-4">This action cannot be undone.</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsDeleteOpen(false)}
                                className="flex-1 py-2.5 bg-muted text-foreground rounded-xl text-xs font-bold hover:opacity-80"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={isProcessing}
                                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700"
                            >
                                {isProcessing ? <Loader2 className="animate-spin mx-auto" size={16} /> : "Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}