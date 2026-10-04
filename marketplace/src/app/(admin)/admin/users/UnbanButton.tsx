"use client";

import { useConfirm } from "@/components/ConfirmProvider";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unbanUserAction } from "../reports/actions";

export default function UnbanButton({ userId, name }: { userId: string; name: string }) {
    const router = useRouter();
    const askConfirm = useConfirm();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handleUnban = async () => {
        const ok = await askConfirm({
            title: `Unban ${name}?`,
            message: "They will be able to sign in, post and message again.",
            confirmText: "Unban",
            tone: "safe",
        });
        if (!ok) return;
        setError(null);
        startTransition(async () => {
            const res = await unbanUserAction(userId);
            if (res.error) setError(res.error);
            else router.refresh();
        });
    };

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                onClick={handleUnban}
                disabled={pending}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
            >
                {pending ? "Unbanning..." : "Unban"}
            </button>
            {error && <span className="text-[10px] text-rose-500 max-w-[140px] text-right">{error}</span>}
        </div>
    );
}