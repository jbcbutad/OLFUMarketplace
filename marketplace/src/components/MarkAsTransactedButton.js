"use client";

import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import MarkAsTransactedModal from "@/components/MarkAsTransactedModal";
import { RefreshCw } from "lucide-react";

export default function MarkAsTransactedButton({
    productId,
    sellerId,
    currentUserId,
    isAvailable,
    tags = [],
}) {
    const [showModal, setShowModal] = useState(false);
    const [modalTargetStatus, setModalTargetStatus] = useState("completed");
    const [loadingReset, setLoadingReset] = useState(false);
    const router = useRouter();

    // Only render for the product seller
    if (!currentUserId || currentUserId !== sellerId) return null;

    const isRental = tags?.includes("Rentals");

    // Action for rentals: Reset product back to available for the next student
    const handleMakeAvailable = async () => {
        setLoadingReset(true);
        try {
            const updatedTags = tags.filter((t) => t !== "Pending");
            const { error } = await supabase
                .from("products")
                .update({ is_available: true, status: "active", tags: updatedTags })
                .eq("id", productId);

            if (error) throw error;
            router.refresh();
        } catch (err) {
            toast.error(err.message || "Failed to make item available.");
        } finally {
            setLoadingReset(false);
        }
    };

    const openModalWithStatus = (status) => {
        setModalTargetStatus(status);
        setShowModal(true);
    };

    return (
        <div className="w-full space-y-2 mb-2">
            {isAvailable ? (
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => openModalWithStatus("pending")}
                        className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-yellow-500 font-bold rounded-xl text-xs transition-colors border border-neutral-700"
                    >
                        Set as Pending
                    </button>
                    <button
                        onClick={() => openModalWithStatus("completed")}
                        className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl text-xs transition-colors"
                    >
                        Mark Completed
                    </button>
                </div>
            ) : (
                <button
                    onClick={handleMakeAvailable}
                    disabled={loadingReset}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
                >
                    <RefreshCw size={14} className={loadingReset ? "animate-spin" : ""} />
                    Make Available Again
                </button>
            )}

            {showModal && (
                <MarkAsTransactedModal
                    productId={productId}
                    sellerId={sellerId}
                    isRental={isRental}
                    targetStatus={modalTargetStatus}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => router.refresh()}
                />
            )}
        </div>
    );
}