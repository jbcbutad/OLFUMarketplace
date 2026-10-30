import Link from "next/link";
import {
    Building2,
    BadgeCheck,
    ShoppingBag,
    Megaphone,
    ArrowRight,
} from "lucide-react";

// TODO: set this to the same link your current "Apply for org badge" button uses
const APPLY_HREF = "/org-apply";
const PERKS = [
    {
        title: "Get the badge",
        body: "A verified Official Merchandise badge shows on your profile and listings.",
        Icon: BadgeCheck,
        icon: "text-emerald-600 dark:text-emerald-300",
        tile: "bg-emerald-100 ring-emerald-300/70 dark:bg-emerald-400/15 dark:ring-emerald-300/30",
    },
    {
        title: "Sell campus merch",
        body: "List shirts, uniforms and event items right on this page.",
        Icon: ShoppingBag,
        icon: "text-amber-600 dark:text-amber-200",
        tile: "bg-amber-100 ring-amber-300/70 dark:bg-amber-300/15 dark:ring-amber-200/30",
    },
    {
        title: "Grow your brand",
        body: "Reach every OLFU student and make your org easy to recognize.",
        Icon: Megaphone,
        icon: "text-sky-600 dark:text-sky-300",
        tile: "bg-sky-100 ring-sky-300/70 dark:bg-sky-400/15 dark:ring-sky-300/30",
    },
];

export default function OrgBanner({ href = APPLY_HREF }) {
    return (
        <section aria-label="Apply for an organization badge" className="mb-6 md:mb-8">
            {/* Gold-to-emerald hairline frame */}
            <div className="rounded-3xl bg-gradient-to-br from-amber-500/70 via-emerald-500/40 to-emerald-700/30 p-px shadow-xl shadow-emerald-900/15 dark:from-amber-400/70 dark:via-emerald-500/30 dark:to-emerald-700/20 dark:shadow-2xl dark:shadow-emerald-950/40">
                <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-gradient-to-br from-emerald-50 via-stone-50 to-amber-50 dark:from-[#07130f] dark:via-[#07130f] dark:to-[#07130f]">
                    {/* Soft glows */}
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-emerald-400/30 blur-3xl dark:bg-emerald-500/30"
                    />
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -bottom-32 -right-24 h-72 w-72 rounded-full bg-amber-300/40 blur-3xl dark:bg-amber-400/15"
                    />

                    {/* Dot texture (dark dots in light mode, light dots in dark mode) */}
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 dark:hidden"
                        style={{
                            backgroundImage:
                                "radial-gradient(rgba(6,78,59,0.12) 1px, transparent 1px)",
                            backgroundSize: "20px 20px",
                        }}
                    />
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 hidden dark:block"
                        style={{
                            backgroundImage:
                                "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
                            backgroundSize: "20px 20px",
                        }}
                    />

                    <div className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-10">
                        {/* Left: pitch + button */}
                        <div className="min-w-0">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/30 bg-emerald-600/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-800 dark:border-white/15 dark:bg-white/10 dark:text-emerald-100">
                                <Building2 size={12} aria-hidden="true" />
                                Official campus organizations
                            </span>

                            <h2 className="mt-3 bg-gradient-to-b from-emerald-900 to-emerald-600 bg-clip-text pb-1 font-serif text-3xl font-black leading-tight tracking-tight text-transparent dark:from-amber-50 dark:to-amber-200 sm:text-4xl">
                                Are you a recognized student org?
                            </h2>

                            <p className="mt-2 max-w-md text-sm font-medium leading-snug text-neutral-700 dark:text-emerald-50/85 sm:text-base">
                                Register your organization to get the{" "}
                                <span className="font-bold text-amber-700 dark:text-amber-300">
                                    Official Merchandise Badge
                                </span>{" "}
                                and start selling to students across OLFU.
                            </p>

                            <Link
                                href={href}
                                className="group mt-5 inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-amber-300 to-amber-400 py-2 pl-5 pr-2 text-xs font-bold uppercase tracking-wide text-black shadow-md shadow-amber-500/25 transition-all hover:from-amber-200 hover:to-amber-300 active:scale-95"
                            >
                                Apply for org badge
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-800 text-white transition-transform group-hover:translate-x-0.5">
                                    <ArrowRight size={14} aria-hidden="true" />
                                </span>
                            </Link>
                        </div>

                        {/* Right: what you get */}
                        <ul className="space-y-3.5 rounded-2xl border border-stone-300 bg-white/80 p-4 shadow-lg shadow-emerald-900/10 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.05] dark:shadow-xl dark:shadow-black/20 sm:p-5">
                            {PERKS.map(({ title, body, Icon, icon, tile }) => (
                                <li key={title} className="flex items-start gap-3">
                                    <span
                                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${tile}`}
                                    >
                                        <Icon size={18} className={icon} aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-neutral-900 dark:text-white">
                                            {title}
                                        </p>
                                        <p className="text-xs text-neutral-600 dark:text-emerald-50/70 sm:text-sm">
                                            {body}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
}