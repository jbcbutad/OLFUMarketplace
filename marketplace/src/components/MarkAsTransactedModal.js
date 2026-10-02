"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { UserCheck, Loader2, X, Search, EyeOff } from "lucide-react";

export default function MarkAsTransactedModal({
    productId,
    sellerId,
    isRental = false,
    isMerchandise = false,
    maxStock = 1,
    deductAmount = 1,
    targetStatus = "pending",
    initialBuyerId = null,        // pre-select this student (e.g. the chat partner)
    allowExternalClose = true,    // set false to hide "Mark as Unavailable (sold elsewhere)"
    onClose,
    onSuccess,                    // called with { transactionId, buyerId } on the atomic path
}) {
    const [buyers, setBuyers] = useState([]);
    const [selectedBuyerId, setSelectedBuyerId] = useState(initialBuyerId || "");
    const [transactionType, setTransactionType] = useState(isRental ? "rental" : "sale");
    const [deductQty, setDeductQty] = useState(deductAmount);
    const [searchQuery, setSearchQuery] = useState("");
    const [isExternalClose, setIsExternalClose] = useState(false); // "Sold Elsewhere"
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        const fetchInquirers = async () => {
            setFetching(true);
            try {
                const { data: myRooms } = await supabase
                    .from("direct_room_members")
                    .select("room_id")
                    .eq("user_id", sellerId);

                const roomIds = myRooms?.map((r) => r.room_id) || [];

                if (roomIds.length > 0) {
                    const { data: chatPartners } = await supabase
                        .from("direct_room_members")
                        .select("user_id")
                        .in("room_id", roomIds)
                        .neq("user_id", sellerId);

                    const buyerIds = [...new Set(chatPartners?.map((p) => p.user_id) || [])];

                    if (buyerIds.length > 0) {
                        const { data: contactProfiles } = await supabase
                            .from("profiles")
                            .select("id, full_name, First_Name, Last_Name, email, avatar_url")
                            .in("id", buyerIds);

                        if (contactProfiles) setBuyers(contactProfiles);
                    }
                }
            } catch (err) {
                console.error("Error fetching contacts:", err);
            } finally {
                setFetching(false);
            }
        };

        if (sellerId) fetchInquirers();
    }, [sellerId]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // If not closing externally, a student must be selected
        if (!isExternalClose && !selectedBuyerId) {
            return alert("Please select a student or choose 'Mark as Unavailable (Sold Elsewhere)'.");
        }

        const qtyNum = isMerchandise ? parseInt(deductQty) || 1 : 1;
        if (isMerchandise && (qtyNum <= 0 || qtyNum > maxStock)) {
            return alert(`Please enter a valid quantity between 1 and ${maxStock}.`);
        }

        setLoading(true);

        try {
            // Plain sale/rental to a chosen student -> one atomic database call.
            // Merchandise, "Set as Pending" and "sold elsewhere" keep the original steps below.
            const useAtomicSale =
                !isMerchandise && !isExternalClose && targetStatus === "completed";

            if (useAtomicSale) {
                const { data: transactionId, error: rpcError } = await supabase.rpc(
                    "mark_product_sold",
                    {
                        p_product: productId,
                        p_buyer: selectedBuyerId,
                        p_type: transactionType,
                    }
                );
                if (rpcError) throw rpcError;

                onSuccess?.({ transactionId, buyerId: selectedBuyerId });
                onClose();
                return;
            }

            const isPendingTarget = targetStatus === "pending";
            const nextStatus = isPendingTarget ? "pending" : "completed";

            // 1. Fetch current product data (tags & stock)
            const { data: prod } = await supabase
                .from("products")
                .select("tags, stock_quantity")
                .eq("id", productId)
                .single();

            let updatedTags = Array.isArray(prod?.tags) ? [...prod.tags] : [];
            if (isPendingTarget) {
                if (!updatedTags.includes("Pending")) updatedTags.push("Pending");
            } else {
                updatedTags = updatedTags.filter((t) => t !== "Pending");
            }

            // 2. Insert transaction record ONLY if a buyer was actually chosen (skip if sold elsewhere)
            if (!isExternalClose && selectedBuyerId) {
                const { error: insertError } = await supabase
                    .from("transactions")
                    .insert([
                        {
                            product_id: productId,
                            seller_id: sellerId,
                            buyer_id: selectedBuyerId,
                            transaction_type: transactionType,
                            status: nextStatus,
                        },
                    ]);

                if (insertError) throw insertError;
            }

            // 3. Handle stock calculation for merchandise vs regular items
            let newStock = prod?.stock_quantity ?? 0;
            let shouldBeAvailable = isPendingTarget ? true : false;

            if (isMerchandise) {
                newStock = Math.max(0, newStock - qtyNum);
                // If they closed externally or stock hit 0, it's unavailable
                shouldBeAvailable = isExternalClose ? false : (newStock > 0 && !isPendingTarget);
            }

            // If it's a regular item and closed externally, force unavailable
            if (isExternalClose) {
                shouldBeAvailable = false;
            }

            // 4. Update product state
            const { error: prodError } = await supabase
                .from("products")
                .update({
                    stock_quantity: newStock,
                    is_available: shouldBeAvailable,
                    status: shouldBeAvailable ? "active" : "unavailable",
                    tags: updatedTags,
                })
                .eq("id", productId);

            if (prodError) throw prodError;

            onSuccess?.();
            onClose();
        } catch (err) {
            alert(err.message || "Failed to process transaction.");
        } finally {
            setLoading(false);
        }
    };

    // Pre-selected buyer floats to the top so it's visible without scrolling.
    const filteredBuyers = buyers
        .filter((b) => {
            const name = `${b.full_name || ""} ${b.First_Name || ""} ${b.Last_Name || ""} ${b.email || ""}`.toLowerCase();
            return name.includes(searchQuery.toLowerCase());
        })
        .sort((a, b) => (b.id === initialBuyerId) - (a.id === initialBuyerId));

    const inputCls =
        "w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-yellow-500 transition-colors";

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="mark-transacted-title"
                className="bg-card text-card-foreground border border-border rounded-3xl p-6 w-full max-w-md shadow-2xl relative"
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute top-4 right-4 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
                >
                    <X size={20} />
                </button>

                <div className="flex items-center gap-2 mb-2 text-yellow-500 pr-8">
                    <UserCheck size={22} />
                    <h3 id="mark-transacted-title" className="text-xl font-bold text-foreground">
                        {targetStatus === "pending" ? "Set as Pending" : "Record Sale & Close"}
                    </h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                    {allowExternalClose
                        ? "Select a student or mark this listing as closed."
                        : "Confirm who bought this item, or pick someone else."}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Sold Elsewhere / External Close Checkbox Option */}
                    {allowExternalClose && (
                        <div
                            onClick={() => setIsExternalClose(!isExternalClose)}
                            className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${isExternalClose
                                ? "bg-amber-500/10 border-amber-500/50 text-foreground"
                                : "bg-muted/60 border-border text-muted-foreground hover:bg-muted"
                                }`}
                        >
                            <EyeOff size={18} className={isExternalClose ? "text-amber-500" : "text-muted-foreground"} />
                            <div className="flex-1">
                                <p className="text-xs font-bold uppercase tracking-wide text-foreground">Mark as Unavailable</p>
                                <p className="text-[10px] text-muted-foreground">Sold elsewhere / Close without tracking a buyer</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={isExternalClose}
                                onChange={() => { }}
                                className="accent-amber-500"
                            />
                        </div>
                    )}

                    {isMerchandise && (
                        <div>
                            <label
                                htmlFor="deduct-qty"
                                className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2"
                            >
                                Quantity to Deduct (Max: {maxStock})
                            </label>
                            <input
                                id="deduct-qty"
                                type="number"
                                min="1"
                                max={maxStock}
                                value={deductQty}
                                onChange={(e) => setDeductQty(e.target.value)}
                                className={`${inputCls} font-bold`}
                            />
                        </div>
                    )}

                    {!isExternalClose && (
                        <div>
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                                Select Student
                            </label>
                            <div className="relative mb-2">
                                <Search size={14} className="absolute left-3 top-3 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search by name or email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className={`${inputCls} pl-9 pr-3`}
                                />
                            </div>

                            {fetching ? (
                                <div className="py-4 flex justify-center text-muted-foreground">
                                    <Loader2 className="animate-spin" size={20} />
                                </div>
                            ) : filteredBuyers.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-2">No recent contacts found.</p>
                            ) : (
                                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                                    {filteredBuyers.map((b) => {
                                        const name = b.full_name || `${b.First_Name || ""} ${b.Last_Name || ""}`.trim() || b.email;
                                        const isSelected = selectedBuyerId === b.id;

                                        return (
                                            <div
                                                key={b.id}
                                                onClick={() => setSelectedBuyerId(b.id)}
                                                className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${isSelected
                                                    ? "bg-yellow-500/10 border-yellow-500/50 text-foreground"
                                                    : "bg-muted/60 border-border text-foreground hover:bg-muted"
                                                    }`}
                                            >
                                                <span className="text-xs font-medium">{name}</span>
                                                <input
                                                    type="radio"
                                                    name="buyer"
                                                    checked={isSelected}
                                                    onChange={() => setSelectedBuyerId(b.id)}
                                                    className="accent-yellow-500"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || (!isExternalClose && !selectedBuyerId)}
                        className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2 cursor-pointer"
                    >
                        {loading ? <Loader2 className="animate-spin" size={18} /> : "Confirm"}
                    </button>
                </form>
            </div>
        </div>
    );
}