"use client";

import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function RelistButton({ productId }) {
    const router = useRouter();

    const handleRelist = async () => {
        await supabase
            .from("products")
            .update({
                status: "active",
                is_available: true,
                updated_at: new Date().toISOString(),
            })
            .eq("id", productId);

        router.refresh();
    };

    return (
        <button
            onClick={handleRelist}
            className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs transition-all active:scale-95 shrink-0"
        >
            Relist Item
        </button>
    );
}