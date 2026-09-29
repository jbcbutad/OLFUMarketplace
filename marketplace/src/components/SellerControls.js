"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Edit3, Trash2, ChevronDown, AlertTriangle, Loader2, X, Layers, CheckCircle, Tag, PhilippinePeso, FileText, PlusCircle, RefreshCcw } from "lucide-react";
import MarkAsTransactedModal from "@/components/MarkAsTransactedModal";

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

    // 👉 Calculate expiration starting from approval/update time (active status only)
    const startDate = new Date(product.updated_at || product.created_at);
    const durationDays = parseInt(product.listing_duration) || 7;
    const expiryDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const isActuallyExpired = isMerchandise && product.status === "active" && new Date() > expiryDate;

    // Automatically sync expired status to database on page load if not already marked
    useEffect(() => {
        if (isActuallyExpired && product.is_available) {
            const markExpiredInDB = async () => {
                let currentTags = Array.isArray(product.tags) ? [...product.tags] : [];
                if (!currentTags.includes("Expired")) currentTags.push("Expired");

                await supabase
                    .from("products")
                    .update({
                        is_available: false,
                        status: "unavailable",
                        tags: currentTags
                    })
                    .eq("id", product.id);

                router.refresh();
            };
            markExpiredInDB();
        }
    }, [isActuallyExpired, product.is_available, product.id, product.tags, router]);

    const [editForm, setEditForm] = useState({
        title: product.title,
        price: product.price,
        description: product.description || "",
        condition: product.condition || "Good",
        course_code: product.course_code || "",
        stock_quantity: currentStock,
    });

    const isFlagged = product.status === "flagged";
    const isPendingAdmin = product.status === "pending" || product.tags?.includes("Pending");
    const isExpiredTag = product.tags?.includes("Expired") || isActuallyExpired;
    const isUnavailable = !product.is_available || isExpiredTag;

    let statusLabel = "Available";
    let statusBadgeStyle = "bg-foreground text-background border-foreground";
    if (isFlagged) {
        statusLabel = "Flagged / Review";
        statusBadgeStyle = "bg-rose-600 text-white border-rose-600";
    } else if (isExpiredTag) {
        statusLabel = "Expired";
        statusBadgeStyle = "bg-amber-600 text-white border-amber-600";
    } else if (isUnavailable) {
        statusLabel = "Unavailable";
        statusBadgeStyle = "bg-muted text-muted-foreground border-border";
    }

    const handleStatusChange = async (choice) => {
        setOpenDropdown(false);

        if (choice === "available") {
            // 👉 BLOCK FLAGGED ITEMS FROM BEING MADE AVAILABLE
            if (isFlagged) {
                alert("This listing cannot be made available because it is flagged under safety review by moderators.");
                return;
            }

            if (isMerchandise) {
                if (isActuallyExpired) {
                    alert("Your merchandise listing duration has expired! You must renew your drop to add stocks and make it available again.");
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
            alert("Cannot restock an expired merchandise drop. Please renew your listing.");
            return;
        }

        const addedStock = parseInt(restockQtyInput);
        if (isNaN(addedStock) || addedStock <= 0) {
            alert("Please enter a valid stock quantity greater than 0.");
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
            alert("Failed to restock: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTriggerMerchSale = () => {
        if (isActuallyExpired) {
            alert("This listing has expired. You cannot record sales until it is renewed.");
            return;
        }

        const qtyToSubtract = parseInt(deductQty) || 1;
        if (qtyToSubtract > currentStock) {
            alert(`Cannot deduct ${qtyToSubtract} units. Only ${currentStock} units left in stock.`);
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
        const shouldBeAvailable = isMerchandise ? updatedStock > 0 && !isActuallyExpired : product.is_available;

        if (isActuallyExpired && !updatedTags.includes("Expired")) {
            updatedTags.push("Expired");
        }

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
                status: shouldBeAvailable ? "active" : "unavailable",
                tags: updatedTags,
            })
            .eq("id", product.id);

        setIsProcessing(false);
        if (!error) {
            setIsEditOpen(false);
            router.refresh();
        } else {
            alert("Failed to update: " + error.message);
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
        <div className="bg-muted/40 border border-border p-4 rounded-2xl my-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                        Listing Management {isMerchandise && `(Stock: ${currentStock})`}
                    </span>
                    {isExpiredTag && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-600 text-white uppercase tracking-widest animate-pulse">
                            EXPIRED DROP
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {isExpiredTag ? (
                        <button
                            onClick={() => router.push(`/mylistings?renew=${product.id}`)}
                            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                        >
                            <RefreshCcw size={13} /> Renew & Pay Listing
                        </button>
                    ) : (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setOpenDropdown(!openDropdown)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border flex items-center gap-1 ${statusBadgeStyle}`}
                            >
                                <span>{statusLabel}</span>
                                <ChevronDown size={14} />
                            </button>

                            {openDropdown && (
                                <div className="absolute right-0 mt-2 w-36 bg-background border border-border rounded-xl shadow-xl py-1 z-30">
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
                                        className="w-full text-left px-3 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-muted uppercase"
                                    >
                                        Unavailable
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        onClick={() => setIsEditOpen(true)}
                        className="p-2 bg-background text-foreground border border-border rounded-xl hover:opacity-80 transition-opacity"
                    >
                        <Edit3 size={15} />
                    </button>
                    <button
                        onClick={() => setIsDeleteOpen(true)}
                        className="p-2 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 transition-colors"
                    >
                        <Trash2 size={15} />
                    </button>
                </div>
            </div>

            {/* Merchandise Quantity Deduction Box */}
            {isMerchandise && product.is_available && currentStock > 0 && !isExpiredTag && (
                <div className="pt-3 border-t border-border space-y-2">
                    <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle size={13} className="text-emerald-600 dark:text-emerald-400" /> Record Sale & Deduct Stock ({currentStock} left):
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min="1"
                            max={currentStock}
                            value={deductQty}
                            onChange={(e) => setDeductQty(e.target.value)}
                            className="w-20 bg-background border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground outline-none"
                        />
                        <button
                            onClick={handleTriggerMerchSale}
                            disabled={currentStock <= 0}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
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