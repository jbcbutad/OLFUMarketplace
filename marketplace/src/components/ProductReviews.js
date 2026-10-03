"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import SellerControls from "@/components/SellerControls";
import MakeOffer from "@/components/MakeOffer";
import RequestToBorrow from "@/components/RequestToBorrow";
import SendMessageToSeller from "@/components/SendMessageToSeller";
import { Mail, Loader2, Building2, MessageSquare, ShieldCheck } from "lucide-react";
import { getListingState } from "@/lib/listingStatus";

// `border-border` is too light to see against stone-200, so every divider and
// outline uses these instead. Change them here to restyle all lines at once.
const LINE = "border-stone-400 dark:border-neutral-700";
const CARD = `bg-stone-100 dark:bg-neutral-800/60 border ${LINE}`;

export default function ProductActions({
    product,
    profile,
    sellerName,
    isVerifiedOrg = false,
    orgName = null,
}) {
    const [currentUserId, setCurrentUserId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [orderQty, setOrderQty] = useState(1);
    const [inquiring, setInquiring] = useState(false);
    const [orderError, setOrderError] = useState(null);
    const [existingRoomId, setExistingRoomId] = useState(null);
    const router = useRouter();

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
                if (user.id !== product.seller_id) {
                    const { data: roomId } = await supabase.rpc("find_product_room", { p_product_id: product.id });
                    setExistingRoomId(roomId ?? null);
                }
            }
            setLoading(false);
        };
        checkUser();
    }, []);

    if (loading) {
        return (
            <div className="py-6 flex justify-center text-muted-foreground">
                <Loader2 className="animate-spin" size={20} />
            </div>
        );
    }

    const isOwner = currentUserId && currentUserId === product.seller_id;

    if (isOwner) {
        return <SellerControls product={product} currentUserId={currentUserId} />;
    }

    const isMerchandise = product.categories?.name === "Merchandise";
    const stockAvailable = product.stock_quantity ?? 1;
    const listingState = getListingState(product);
    const canBuy = listingState === "active";

    // 👉 Handle Merchandise Inquiry & Messaging Flow
    const handleInquireMerchandise = async () => {
        if (!currentUserId) {
            router.push("/login");
            return;
        }

        if (orderQty > stockAvailable) {
            setOrderError(`Only ${stockAvailable} units left in stock.`);
            return;
        }

        setInquiring(true);
        setOrderError(null);

        try {
            const { data: roomId, error } = await supabase.rpc("get_or_create_product_room", {
                p_product_id: product.id,
            });
            if (error || !roomId) throw new Error(error?.message || "Failed to open chat.");

            const body = `Hi! I would like to order ${orderQty} unit(s) of "${product.title}" (Total: ₱${(product.price * orderQty).toLocaleString()}). I'll send my GCash payment screenshot here.`;
            const res = await fetch("/api/direct-messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ roomId, body, image_url: null }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Failed to send order message.");
            }

            // The button stays in its loading state until the redirect finishes
            router.push(`/chat/${roomId}?sellerId=${product.seller_id}&productId=${product.id}`);
        } catch (err) {
            setOrderError(err.message || "Failed to open chat. Please try again.");
            setInquiring(false);
        }
    };

    const isRentalOrBorrow = product.tags?.some((tag) =>
        ["Rentals", "Rental", "Borrow", "For Borrow"].includes(tag)
    );

    return (
        <div className="space-y-6">
            {/* Seller info first */}
            <div className={`pt-4 border-t ${LINE}`}>
                {/* Clickable Seller Profile Link */}
                <Link
                    href={`/profile/${product.seller_id}`}
                    className="flex items-center gap-3 group hover:opacity-80 transition-opacity w-fit"
                >
                    {/* 👉 AVATAR WITH CONDITIONAL VERIFIED ORG GLOW & CHECKMARK BADGE */}
                    <div className="relative shrink-0">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold overflow-hidden shadow-md transition-all ${isVerifiedOrg
                            ? "border-2 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)] bg-emerald-600 text-white"
                            : `border-2 ${LINE} bg-stone-300 dark:bg-neutral-800 text-neutral-900 dark:text-white`
                            }`}>
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt="Seller Avatar" className="w-full h-full object-cover" />
                            ) : (
                                sellerName?.charAt(0).toUpperCase()
                            )}
                        </div>

                        {/* Floating Checkmark Badge */}
                        {isVerifiedOrg && (
                            <div className="absolute -bottom-0.5 -right-0.5 bg-emerald-600 text-white p-0.5 rounded-full border-2 border-background shadow-sm flex items-center justify-center" title="Verified Official Organization">
                                <ShieldCheck size={11} />
                            </div>
                        )}
                    </div>

                    <div>
                        <div className="text-sm font-bold text-foreground group-hover:underline flex items-center gap-2 flex-wrap">
                            <span>{sellerName}</span>

                            {/* VERIFIED ORG BADGE */}
                            {isVerifiedOrg && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-md text-[11px] font-bold no-underline">
                                    <Building2 size={12} />
                                    <span>{orgName || "Verified Org"}</span>
                                </span>
                            )}
                        </div>

                    </div>
                </Link>
            </div>

            {/* Logged-out visitors can browse but not contact the seller */}
            {canBuy && !currentUserId ? (
                <div className={`pt-4 border-t ${LINE}`}>
                    <div className={`p-4 rounded-2xl ${CARD} space-y-3 text-center`}>
                        <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                            Log in to message the seller or make an offer.
                        </p>
                        <Link
                            href="/login"
                            className="inline-flex items-center justify-center px-5 py-2.5 bg-foreground text-background font-bold rounded-xl hover:opacity-90 transition-opacity text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                            Log in
                        </Link>
                    </div>
                </div>
            ) : canBuy ? (
                <div className={`space-y-4 pt-4 border-t ${LINE}`}>

                    {/* 👉 MERCHANDISE QUANTITY & MESSAGING / INQUIRY FLOW */}
                    {isMerchandise ? (
                        <div className={`p-4 ${CARD} rounded-2xl space-y-4`}>
                            <div className="flex items-center justify-between text-xs font-bold text-foreground">
                                <span>Select Quantity:</span>
                                <span className="text-emerald-600 dark:text-emerald-400">{stockAvailable} Units Available</span>
                            </div>

                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="1"
                                    max={stockAvailable}
                                    value={orderQty}
                                    onChange={(e) => setOrderQty(Math.min(parseInt(e.target.value) || 1, stockAvailable))}
                                    aria-label="Quantity"
                                    className="w-24 bg-stone-200 border border-stone-800 rounded-xl px-3 py-2 text-xs font-bold text-neutral-900 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-600/30 transition-all dark:bg-neutral-800 dark:text-white dark:border-neutral-700 dark:focus:border-emerald-600"
                                />
                                <button
                                    onClick={handleInquireMerchandise}
                                    disabled={inquiring || stockAvailable <= 0}
                                    className="flex-1 py-3 bg-foreground text-background hover:opacity-90 text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                >
                                    {inquiring ? (
                                        <><Loader2 className="animate-spin" size={16} /> Opening Chat...</>
                                    ) : stockAvailable <= 0 ? (
                                        "Sold Out"
                                    ) : (
                                        <><MessageSquare size={16} /> Order & Message Org (₱{(product.price * orderQty).toLocaleString()})</>
                                    )}
                                </button>
                            </div>
                            {orderError && (
                                <p role="alert" className="text-xs font-medium text-rose-600 dark:text-rose-400 text-center">
                                    {orderError}
                                </p>
                            )}
                            <p className="text-[11px] text-muted-foreground text-center">
                                Clicking this opens a chat with the organization to send your GCash receipt.
                            </p>
                        </div>
                    ) : (
                        <MakeOffer sellerId={product.seller_id} productTitle={product.title} productId={product.id} />
                    )}

                    {/* ONLY SHOWN FOR RENTAL/BORROW ITEMS */}
                    {isRentalOrBorrow && !isMerchandise && (
                        <RequestToBorrow sellerId={product.seller_id} productTitle={product.title} productId={product.id} />
                    )}
                </div>
            ) : (
                <div className={`pt-4 border-t ${LINE}`}>
                    <div className={`p-4 rounded-2xl ${CARD} text-xs font-bold text-neutral-700 dark:text-neutral-300`}>
                        {listingState === "expired"
                            ? "This listing has expired."
                            : "This listing is no longer available."}
                    </div>
                </div>
            )}

            {/* Message box (logged-in buyers only). It draws its own top divider. */}
            {currentUserId && (
                <SendMessageToSeller sellerId={product.seller_id} productId={product.id} existingRoomId={existingRoomId} />
            )}
        </div>
    );
}