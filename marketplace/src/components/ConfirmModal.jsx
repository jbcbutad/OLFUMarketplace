"use client";

import { AlertTriangle } from "lucide-react";

/**
 * Shared confirm dialog used by ChatHub and ChatRoom.
 * Put this file at: src/components/ConfirmModal.jsx
 */
export default function ConfirmModal({
    title,
    description,
    confirmLabel = "Confirm",
    tone = "danger", // "danger" | "safe"
    showIcon = false,
    onConfirm,
    onCancel,
}) {
    const confirmClass =
        tone === "safe"
            ? "bg-emerald-600 hover:bg-emerald-700"
            : "bg-rose-600 hover:bg-rose-700";

    return (
        <div
            className="fixed inset-0 bg-black/75 z-[9999] backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={onCancel}
        >
            <div
                className="relative z-10 w-full max-w-md bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {showIcon && (
                    <div className="w-10 h-10 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-full flex items-center justify-center mb-3 border border-rose-500/20">
                        <AlertTriangle size={20} />
                    </div>
                )}
                <h3 className="text-lg font-bold mb-1">{title}</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6">{description}</p>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-xs font-bold border border-neutral-200 dark:border-neutral-700 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-700 dark:text-neutral-300 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-colors cursor-pointer shadow-xs ${confirmClass}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}