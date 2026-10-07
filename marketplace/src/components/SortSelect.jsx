"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Check } from "lucide-react";
import { SORT_OPTIONS } from "@/lib/sort";

export default function SortSelect({ value, hrefs }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [current, setCurrent] = useState(value);
    const ref = useRef(null);

    useEffect(() => {
        setCurrent(value);
    }, [value]);

    // Close on outside click or Escape
    useEffect(() => {
        if (!open) return;
        const onPointer = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const choose = (v) => {
        setOpen(false);
        if (v === current) return;
        setCurrent(v);
        router.push(hrefs[v], { scroll: false });
    };

    const isDefault = current === "newest";
    const label = isDefault
        ? "Sort"
        : SORT_OPTIONS.find((o) => o.value === current)?.label ?? "Sort";

    return (
        <div className="relative inline-block" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-label="Sort items"
                aria-haspopup="menu"
                aria-expanded={open}
                className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm font-medium transition-colors hover:bg-stone-200/70 dark:hover:bg-neutral-800 ${isDefault
                        ? "text-neutral-700 hover:text-foreground dark:text-neutral-300 dark:hover:text-white"
                        : "text-emerald-700 dark:text-emerald-400"
                    }`}
            >
                <ArrowUpDown size={14} aria-hidden="true" />
                <span>{label}</span>
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute left-0 top-full z-30 mt-1 w-52 rounded-xl border border-stone-800 bg-stone-100 py-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
                >
                    {SORT_OPTIONS.map((o) => {
                        const on = o.value === current;
                        return (
                            <button
                                key={o.value}
                                type="button"
                                role="menuitemradio"
                                aria-checked={on}
                                onClick={() => choose(o.value)}
                                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-xs text-neutral-900 hover:bg-emerald-50 dark:text-white dark:hover:bg-emerald-950 ${on ? "font-semibold" : "font-medium"
                                    }`}
                            >
                                {o.label}
                                {on && <Check size={14} className="text-emerald-600" aria-hidden="true" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}