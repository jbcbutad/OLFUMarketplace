"use client";

import { useEffect } from "react";
import { X, ShieldCheck, FileText, AlertTriangle, DollarSign, CheckCircle2, UserCheck, MessageSquareWarning } from "lucide-react";

export default function MerchTermsModal({ isOpen, onClose }) {
    useEffect(() => {
        if (!isOpen) return undefined;
        const handleKeyDown = (event) => {
            if (event.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
            role="presentation"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="merch-terms-title"
                className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 shadow-2xl border border-neutral-200 dark:border-neutral-800 animate-in zoom-in-95 duration-200"
            >
                {/* HEADER */}
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 px-6 py-4 bg-neutral-50/50 dark:bg-neutral-900/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <ShieldCheck size={22} />
                        </div>
                        <div>
                            <h2 id="merch-terms-title" className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                                Official OLFU Merchandise Terms & Conditions
                            </h2>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">Student Merchandise Listing Guidelines</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close terms"
                        className="rounded-full p-2 text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* SUBHEADER NOTICE */}
                <div className="border-b border-neutral-100 dark:border-neutral-800 bg-emerald-50/40 dark:bg-emerald-950/20 px-6 py-3 flex items-center gap-2.5">
                    <FileText size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 font-medium">
                        Students wishing to post and sell Official OLFU Merchandise must read and comply with the following policies.
                    </p>
                </div>

                {/* CONTENT CARDS */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 scrollbar-thin">

                    <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 space-y-1">
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                            <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                            Approval Required for Student Merchandise Listings
                        </h4>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed pl-6">
                            A student who wishes to post Official OLFU Merchandise must first submit the listing for approval before it can be made available on the marketplace.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 space-y-1">
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                            <UserCheck size={15} className="text-sky-600 dark:text-sky-400" />
                            Faculty or Organization Adviser Verification
                        </h4>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed pl-6">
                            The student's organization adviser or faculty member must verify that the student and merchandise are legitimately connected to the organization. The faculty member or adviser must contact marketplace administrators through official channels to confirm authorization.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 space-y-1">
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                            <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400" />
                            Approval Before Posting
                        </h4>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed pl-6">
                            The Official OLFU Merchandise listing will only become available after required verification has been received and the listing has been approved by the marketplace Administrator.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 space-y-1">
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                            <DollarSign size={15} className="text-amber-500" />
                            ₱1.00 Per-Day Listing Fee
                        </h4>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed pl-6">
                            Each approved Official OLFU Merchandise listing costs ₱1.00 per day while active. This listing fee applies exclusively to Official OLFU Merchandise and does not affect regular preloved-item listings.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 space-y-1">
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                            <FileText size={15} className="text-indigo-500" />
                            Accurate Merchandise Information & Authenticity
                        </h4>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed pl-6">
                            Students must provide accurate data (name, description, pricing, quantity, variations, images). Only authorized merchandise may be posted; counterfeit products or falsely represented items are strictly prohibited.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 space-y-1">
                        <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                            <MessageSquareWarning size={15} className="text-blue-500" />
                            Listing Review & Reporting
                        </h4>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed pl-6">
                            Administrators may review, approve, reject, or remove non-compliant listings. Users may also report unauthorized, misleading, or counterfeit merchandise for administrative investigation.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/20 space-y-1">
                        <h4 className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-2">
                            <AlertTriangle size={15} className="text-rose-600 dark:text-rose-400" />
                            Violation of Approval Requirements & Transactions
                        </h4>
                        <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed pl-6">
                            False information or unverified posts result in listing removal and restricted account access. Additionally, the marketplace does not handle payments or delivery; buyers and sellers handle physical exchanges independently.
                        </p>
                    </div>

                </div>

                {/* FOOTER */}
                <div className="border-t border-neutral-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-between bg-neutral-50 dark:bg-neutral-900/50">
                    <p className="text-[11px] text-neutral-500 font-medium">
                        OLFU Valenzuela Marketplace • Student Merch Policy
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-6 py-2.5 text-xs font-bold text-white transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                        I Understand & Agree
                    </button>
                </div>
            </section>
        </div>
    );
}