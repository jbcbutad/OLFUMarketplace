"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

// Styled replacement for window.confirm.
//
//   const [askConfirm, confirmDialog] = useConfirm();
//   if (!(await askConfirm({ title, message, confirmLabel, tone }))) return;
//   ...
//   return (<> ...page... {confirmDialog} </>);
//
// tone: "warning" (default) or "danger" (red confirm button, for removing things)

function ConfirmDialog({ title, message, confirmLabel, cancelLabel, tone = "warning", onClose }) {
    const cancelRef = useRef(null);
    const danger = tone === "danger";

    useEffect(() => {
        cancelRef.current?.focus(); // the safe choice is focused first
        const onKey = (e) => {
            if (e.key === "Escape") onClose(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose(false);
            }}
        >
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                aria-describedby="confirm-message"
                className="w-full max-w-sm rounded-3xl border border-border bg-background p-6 shadow-2xl"
            >
                <div
                    className={`mb-4 flex h-11 w-11 items-center justify-center rounded-full ${danger ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                        }`}
                >
                    {danger ? <Trash2 size={20} /> : <AlertTriangle size={20} />}
                </div>

                <h3 id="confirm-title" className="text-base font-extrabold tracking-tight text-foreground">
                    {title}
                </h3>
                <p id="confirm-message" className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {message}
                </p>

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={() => onClose(false)}
                        className="flex-1 rounded-2xl bg-muted py-3 text-sm font-bold text-foreground transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
                    >
                        {cancelLabel || "Cancel"}
                    </button>
                    <button
                        type="button"
                        onClick={() => onClose(true)}
                        className={`flex-1 rounded-2xl py-3 text-sm font-bold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground ${danger ? "bg-red-600 text-white" : "bg-foreground text-background"
                            }`}
                    >
                        {confirmLabel || "Continue"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function useConfirm() {
    const [opts, setOpts] = useState(null);
    const resolverRef = useRef(null);

    const askConfirm = useCallback(
        (options) =>
            new Promise((resolve) => {
                resolverRef.current?.(false); // never leave an earlier question hanging
                resolverRef.current = resolve;
                setOpts(options);
            }),
        []
    );

    const close = useCallback((result) => {
        const resolve = resolverRef.current;
        resolverRef.current = null;
        setOpts(null);
        resolve?.(result);
    }, []);

    // If the page goes away while a question is open, treat it as Cancel
    useEffect(() => {
        return () => {
            resolverRef.current?.(false);
            resolverRef.current = null;
        };
    }, []);

    const element = opts ? <ConfirmDialog {...opts} onClose={close} /> : null;
    return [askConfirm, element];
}

export default ConfirmDialog;