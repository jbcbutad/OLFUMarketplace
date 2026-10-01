"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { banUserAction } from "../reports/actions";

export default function BanButton({ userId, name }: { userId: string; name: string }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const close = () => { setOpen(false); setReason(""); setError(null); };

    const submit = () => {
        if (!reason.trim()) return;
        setError(null);
        startTransition(async () => {
            const res = await banUserAction(userId, reason.trim(), null);
            if (res.error) { setError(res.error); return; }
            close();
            router.refresh();
        });
    };

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
            >
                Ban
            </button>

            {open && (
                <div className="fixed inset-0 bg-black/75 z-[9999] backdrop-blur-md flex items-center justify-center p-4 text-left" onClick={close}>
                    <div
                        className="w-full max-w-md bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-bold mb-1">Ban {name}?</h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                            They are signed out, cannot post or message, and their listings are hidden. An admin can reverse this.
                        </p>
                        <textarea
                            className="w-full min-h-[90px] bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700 rounded-xl p-3 text-xs font-medium focus:outline-none resize-none mb-3"
                            placeholder="Reason (required, saved on the account)"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                        {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}
                        <div className="flex justify-end gap-3">
                            <button onClick={close} className="px-4 py-2 text-xs font-bold border border-neutral-200 dark:border-neutral-700 rounded-xl cursor-pointer">
                                Cancel
                            </button>
                            <button
                                onClick={submit}
                                disabled={!reason.trim() || pending}
                                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl disabled:opacity-40 cursor-pointer"
                            >
                                {pending ? "Banning..." : "Confirm ban"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}