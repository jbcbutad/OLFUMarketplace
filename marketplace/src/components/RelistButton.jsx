"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function RelistButton({
    productId,
    label = "Relist (Free)",
    className = "px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs transition-all active:scale-95 shrink-0",
    onDone,
}) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    const handleRelist = async () => {
        if (busy) return;
        setBusy(true);

        const { error } = await supabase.rpc("relist_product", {
            p_product_id: productId,
        });

        setBusy(false);

        if (error) {
            alert(error.message);
            return;
        }

        onDone?.();
        router.refresh();
    };

    return (
        <button
            type="button"
            onClick={handleRelist}
            disabled={busy}
            className={`${className} disabled:opacity-60`}
        >
            {busy ? "Relisting..." : label}
        </button>
    );
}