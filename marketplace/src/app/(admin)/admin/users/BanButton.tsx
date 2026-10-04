"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { banUserAction } from "../reports/actions";
import { btn, ui } from "../ui";

const QUICK_REASONS = ["Scam or fraud", "Harassment", "Prohibited items", "Spam", "Repeated violations"];

export default function BanButton({ userId, name }: { userId: string; name: string }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const close = () => { setOpen(false); setReason(""); setError(null); };

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    const submit = () => {
        if (!reason.trim()) return;
        setError(null);
        startTransition(async () => {
            const res = await banUserAction(userId, reason.trim(), null);
            if (res.error) { setError(res.error); return; }
            toast.success(`${name} was banned`);
            close();
            router.refresh();
        });
    };

    return (
        <>
            <button onClick={() => setOpen(true)} className={btn("dangerOutline", "sm")} title={`Ban ${name}`}>
                <Ban size={13} /> Ban
            </button>

            {open && (
                <div
                    className="fixed inset-0 bg-black/60 z-[9999] backdrop-blur-sm flex items-center justify-center p-4 text-left"
                    onClick={close}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="w-full max-w-md bg-surface text-foreground border border-line rounded-2xl p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3 mb-4">
                            <div className="p-2.5 rounded-xl bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 shrink-0">
                                <ShieldAlert size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-bold leading-tight truncate">Ban {name}?</h3>
                                <p className="text-xs text-ink-soft mt-1">
                                    They are signed out, cannot post or message, and their listings are hidden.
                                    An admin can reverse this.
                                </p>
                            </div>
                            <button onClick={close} className={btn("ghost", "sm")} aria-label="Close">
                                <X size={16} />
                            </button>
                        </div>

                        <label className="text-xs font-bold text-ink-soft block mb-2">Reason</label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {QUICK_REASONS.map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setReason(r)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${reason === r
                                        ? "bg-brand text-on-brand border-brand"
                                        : "bg-background text-ink-soft border-line hover:bg-tint hover:text-brand-deep"
                                        }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                        <textarea
                            className={`${ui.input} w-full min-h-[90px] resize-none mb-3 text-xs`}
                            placeholder="Reason (required, saved on the account)"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                        {error && <p className="text-xs text-red-600 dark:text-red-400 mb-3">{error}</p>}

                        <div className="flex justify-end gap-2">
                            <button onClick={close} className={btn("outline")}>Cancel</button>
                            <button onClick={submit} disabled={!reason.trim() || pending} className={btn("danger")}>
                                {pending ? "Banning..." : "Confirm ban"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
