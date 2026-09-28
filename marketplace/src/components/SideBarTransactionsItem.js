"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, ShoppingCart, ShoppingBag, ChevronDown } from "lucide-react";

export default function SidebarTransactionsItem() {
    const pathname = usePathname();
    const isTransactionPage =
        pathname === "/purchase-history" || pathname === "/sales-history";

    const [isOpen, setIsOpen] = useState(isTransactionPage);

    return (
        <div className="w-full">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${isTransactionPage
                        ? "text-yellow-500 bg-yellow-500/10 font-bold"
                        : "text-neutral-400 hover:text-foreground hover:bg-neutral-800/50"
                    }`}
            >
                <div className="flex items-center gap-3">
                    <History size={18} className={isTransactionPage ? "text-yellow-500" : "text-neutral-400"} />
                    <span>Transactions</span>
                </div>
                <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {isOpen && (
                <div className="ml-7 mt-1 pl-2 border-l border-neutral-800 space-y-1">
                    <Link
                        href="/purchase-history"
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${pathname === "/purchase-history"
                                ? "text-yellow-500 font-bold bg-yellow-500/10"
                                : "text-neutral-400 hover:text-foreground hover:bg-neutral-800/40"
                            }`}
                    >
                        <ShoppingCart size={14} />
                        <span>Purchase History</span>
                    </Link>

                    <Link
                        href="/sales-history"
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${pathname === "/sales-history"
                                ? "text-yellow-500 font-bold bg-yellow-500/10"
                                : "text-neutral-400 hover:text-foreground hover:bg-neutral-800/40"
                            }`}
                    >
                        <ShoppingBag size={14} />
                        <span>Sales History</span>
                    </Link>
                </div>
            )}
        </div>
    );
}