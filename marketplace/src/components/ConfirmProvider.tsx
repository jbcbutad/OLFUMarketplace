"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import ConfirmModal from "@/components/ConfirmModal";

export type ConfirmOptions = {
    title: string;
    message: string;
    confirmText?: string;
    tone?: "danger" | "safe";
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

// If a page is ever rendered outside the provider, fall back to the browser
// popup instead of crashing.
const fallback: ConfirmFn = async (o) => window.confirm(`${o.title}\n\n${o.message}`);

const ConfirmContext = createContext<ConfirmFn>(fallback);

/** const askConfirm = useConfirm();  if (!(await askConfirm({ title, message }))) return; */
export const useConfirm = () => useContext(ConfirmContext);

type Pending = { options: ConfirmOptions; resolve: (v: boolean) => void };

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [pending, setPending] = useState<Pending | null>(null);
    const pendingRef = useRef<Pending | null>(null);

    const confirm = useCallback<ConfirmFn>((options) => {
        return new Promise<boolean>((resolve) => {
            pendingRef.current?.resolve(false); // a newer prompt replaces an older one
            const next = { options, resolve };
            pendingRef.current = next;
            setPending(next);
        });
    }, []);

    const settle = useCallback((result: boolean) => {
        const current = pendingRef.current;
        if (!current) return;
        pendingRef.current = null;
        setPending(null);
        current.resolve(result);
    }, []);

    // Escape = cancel
    useEffect(() => {
        if (!pending) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") settle(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [pending, settle]);

    // Never leave a caller hanging if the provider unmounts
    useEffect(() => () => pendingRef.current?.resolve(false), []);

    const tone = pending?.options.tone ?? "danger";

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {pending && (
                <ConfirmModal
                    title={pending.options.title}
                    description={pending.options.message}
                    confirmLabel={pending.options.confirmText ?? "Confirm"}
                    tone={tone}
                    showIcon={tone === "danger"}
                    onConfirm={() => settle(true)}
                    onCancel={() => settle(false)}
                />
            )}
        </ConfirmContext.Provider>
    );
}