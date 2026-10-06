"use client";

import { useConfirm } from "@/components/ConfirmProvider";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { isMerch } from "@/lib/merch";
import { Loader2, CheckCircle2, XCircle, ShieldCheck, Layers, Calendar, PhilippinePeso } from "lucide-react";
import { ui, btn } from "../ui";

export default function AdminMerchApprovals() {
    const askConfirm = useConfirm();
    const [pendingItems, setPendingItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        fetchPendingMerch();
    }, []);

    const fetchPendingMerch = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("products")
                .select(`
          *,
          profiles(full_name, org_name),
          categories(name)
        `)
                .eq("status", "pending")
                .order("created_at", { ascending: false });

            if (!error) setPendingItems((data || []).filter((p) => isMerch(p)));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const approveMerchDrop = async (item) => {
        setProcessingId(item.id);
        const { error } = await supabase.rpc("approve_merch_drop", {
            p_product_id: item.id,
        });

        if (error) {
            console.error("Approval error:", error);
            toast.error("Failed to approve item: " + error.message);
        } else {
            setPendingItems((prev) => prev.filter((p) => p.id !== item.id));
        }
        setProcessingId(null);
    };

    const rejectMerchDrop = async (productId) => {
        const ok = await askConfirm({
            title: "Reject this merchandise?",
            message: "It will be marked as rejected and removed from the approval queue.",
            confirmText: "Reject",
        });
        if (!ok) return;
        setProcessingId(productId);
        try {
            const { error } = await supabase
                .from("products")
                .update({ status: "rejected", is_available: false })
                .eq("id", productId);

            if (!error) {
                setPendingItems(prev => prev.filter(item => item.id !== productId));
            }
        } catch (err) {
            console.error("Rejection error:", err);
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) return (
        <div className="min-h-[300px] flex items-center justify-center">
            <Loader2 className="animate-spin text-brand" size={32} />
        </div>
    );

    return (
        <div className="text-foreground">
            <div className={ui.page}>

                <div className={ui.headerBar}>
                    <div>
                        <h1 className={ui.title}>
                            <ShieldCheck className={ui.titleIcon} size={28} /> Merchandise Approvals
                        </h1>
                        <p className={ui.subtitle}>
                            Verify GCash listing payments and publish organization drops.
                        </p>
                    </div>
                    <div className={ui.countBadge}>
                        {pendingItems.length} Pending
                    </div>
                </div>

                {pendingItems.length === 0 ? (
                    <div className={`${ui.empty} py-20`}>
                        <p className="text-sm">
                            No pending merchandise drops awaiting payment review.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {pendingItems.map((item) => {
                            const orgName = item.profiles?.org_name || item.profiles?.full_name || "Organization";
                            return (
                                <div key={item.id} className={`${ui.card} p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6`}>

                                    <div className="flex items-center gap-5">
                                        <img
                                            src={item.image_urls?.[0] || "/placeholder.png"}
                                            alt={item.title}
                                            className="w-24 h-24 rounded-2xl object-cover border border-line"
                                        />
                                        <div className="space-y-1">
                                            <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-md font-bold uppercase tracking-widest">
                                                {orgName}
                                            </span>
                                            <h3 className="text-lg font-bold text-foreground">{item.title}</h3>
                                            <p className="text-xs text-ink-soft flex items-center gap-1 font-bold">
                                                Item Selling Price: <PhilippinePeso size={12} />{item.price}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 p-4 bg-background border border-line rounded-2xl w-full lg:w-auto text-xs">
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-ink-soft flex items-center gap-1">
                                                <Layers size={12} /> Stock
                                            </p>
                                            <p className="font-extrabold text-foreground text-sm mt-0.5">{item.stock_quantity || 1} Units</p>
                                        </div>

                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-ink-soft flex items-center gap-1">
                                                <Calendar size={12} /> Duration
                                            </p>
                                            <p className="font-extrabold text-foreground text-sm mt-0.5">{item.listing_duration || "N/A"}</p>
                                        </div>

                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-amber-500 flex items-center gap-1">
                                                Required Fee
                                            </p>
                                            <p className="font-black text-amber-600 dark:text-amber-400 text-sm mt-0.5">₱{item.listing_fee || 0}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 w-full lg:w-auto">
                                        <button
                                            onClick={() => approveMerchDrop(item)}
                                            disabled={processingId === item.id}
                                            className={`${btn("primary", "md")} flex-1 lg:flex-initial`}
                                        >
                                            {processingId === item.id ? <Loader2 className="animate-spin" size={16} /> : <><CheckCircle2 size={16} /> Approve & Publish</>}
                                        </button>

                                        <button
                                            title="Reject merchandise"
                                            onClick={() => rejectMerchDrop(item.id)}
                                            disabled={processingId === item.id}
                                            className={btn("dangerOutline", "md")}
                                        >
                                            <XCircle size={18} />
                                        </button>
                                    </div>

                                </div>
                            );
                        })}
                    </div>
                )}

            </div>
        </div>
    );
}