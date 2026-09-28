"use client";

import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";

export default function OrgBanner() {
    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-800 p-4 md:p-6 text-white shadow-md mb-6">
            {/* Soft background glow */}
            <div className="absolute -right-8 -bottom-8 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-2xl">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/15 text-[11px] font-bold uppercase tracking-wider text-emerald-100 border border-white/20">
                        <Building2 size={13} /> Official Campus Organizations
                    </div>
                    <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">
                        Are you a Recognized Student Org?
                    </h2>
                    <p className="text-emerald-100 text-xs md:text-sm font-medium leading-relaxed">
                        Register your organization to get an <span className="text-amber-300 font-bold">Official Merchandise Badge</span>, sell campus merchandise, and build your brand identity across OLFU!
                    </p>
                </div>

                <Link
                    href="/org-apply"
                    className="shrink-0 inline-flex items-center gap-3 pl-5 pr-2.5 py-2.5 bg-white text-emerald-950 hover:bg-emerald-50 font-extrabold text-xs uppercase tracking-wider rounded-full shadow-md transition-all active:scale-95 cursor-pointer group"
                >
                    <span>Apply for Org Badge</span>
                    <div className="w-6 h-6 rounded-full bg-emerald-950 text-white flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
                        <ArrowRight size={13} />
                    </div>
                </Link>
            </div>
        </div>
    );
}