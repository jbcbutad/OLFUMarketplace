"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { Loader2, CheckCircle2, XCircle, ShieldCheck, Layers, Calendar, PhilippinePeso } from "lucide-react";

export default function AdminMerchApprovals() {
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
          categories!inner(name)
        `)
                .eq("status", "pending")
                .eq("categories.name", "Merchandise")
                .order("created_at", { ascending: false });

            if (!error) setPendingItems(data || []);
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
            alert("Failed to approve item: " + error.message);
        } else {
            setPendingItems((prev) => prev.filter((p) => p.id !== item.id));
        }
        setProcessingId(null);
    };

    const rejectMerchDrop = async (productId) => {
        if (!confirm("Are you sure you want to reject this merchandise?")) return;
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
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
            <Loader2 className="animate-spin text-foreground" size={32} />
        </div>
    );

    return (
        <div className="bg-background text-foreground min-h-screen p-6 md:p-10">
            <div className="max-w-6xl mx-auto space-y-8">

                <div className="flex justify-between items-center border-b border-neutral-200 dark:border-neutral-800 pb-6">
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                            <ShieldCheck className="text-amber-500" size={32} /> Merchandise Approvals
                        </h1>
                        <p className="text-xs text-neutral-500 mt-1">
                            Verify GCash listing payments and publish organization drops.
                        </p>
                    </div>
                    <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-2xl text-xs font-extrabold">
                        {pendingItems.length} Pending
                    </div>
                </div>

                {pendingItems.length === 0 ? (
                    <div className="text-center py-24 bg-neutral-50 dark:bg-neutral-900/40 rounded-3xl border border-dashed border-neutral-300 dark:border-neutral-800">
                        <p className="text-neutral-400 text-sm font-bold uppercase tracking-wider">
                            No pending merchandise drops awaiting payment review.
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {pendingItems.map((item) => {
                            const orgName = item.profiles?.org_name || item.profiles?.full_name || "Organization";
                            return (
                                <div key={item.id} className="p-6 bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 rounded-3xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 shadow-sm">

                                    <div className="flex items-center gap-5">
                                        <img
                                            src={item.image_urls?.[0] || "/placeholder.png"}
                                            alt={item.title}
                                            className="w-24 h-24 rounded-2xl object-cover border border-neutral-200 dark:border-neutral-800"
                                        />
                                        <div className="space-y-1">
                                            <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-md font-bold uppercase tracking-widest">
                                                {orgName}
                                            </span>
                                            <h3 className="text-xl font-black uppercase tracking-tight text-foreground">{item.title}</h3>
                                            <p className="text-xs text-neutral-500 flex items-center gap-1 font-bold">
                                                Item Selling Price: <PhilippinePeso size={12} />{item.price}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 p-4 bg-background border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full lg:w-auto text-xs">
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1">
                                                <Layers size={12} /> Stock
                                            </p>
                                            <p className="font-extrabold text-foreground text-sm mt-0.5">{item.stock_quantity || 1} Units</p>
                                        </div>

                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-neutral-400 flex items-center gap-1">
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
                                            className="flex-1 lg:flex-initial px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {processingId === item.id ? <Loader2 className="animate-spin" size={16} /> : <><CheckCircle2 size={16} /> Approve & Publish</>}
                                        </button>

                                        <button
                                            onClick={() => rejectMerchDrop(item.id)}
                                            disabled={processingId === item.id}
                                            className="px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-xs font-bold transition-all"
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