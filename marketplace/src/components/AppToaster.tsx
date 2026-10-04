"use client";

import { Toaster } from "sonner";
import { useTheme } from "next-themes";

const BASE =
    "w-full sm:w-[356px] flex items-center gap-2.5 px-4 py-3 rounded-2xl border shadow-xl text-xs font-bold " +
    "bg-stone-200 text-black border-stone-800 dark:bg-neutral-800 dark:text-white dark:border-neutral-700";

export default function AppToaster() {
    const { resolvedTheme } = useTheme();

    return (
        <Toaster
            position="top-center"
            theme={resolvedTheme === "dark" ? "dark" : "light"}
            duration={4000}
            toastOptions={{
                unstyled: true,
                classNames: {
                    toast: BASE,
                    success: "!border-emerald-600",
                    error:
                        "!bg-rose-50 !border-rose-500/40 !text-rose-600 dark:!bg-rose-500/15 dark:!text-rose-400",
                    warning: "!border-amber-500",
                    title: "font-bold",
                    description: "font-medium opacity-80",
                },
            }}
        />
    );
}