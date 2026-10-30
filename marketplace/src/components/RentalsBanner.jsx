import {
    BookOpen,
    Calculator,
    Laptop,
    Shirt,
    FlaskConical,
    PencilRuler,
    Palette,
    Wrench,
    Camera,
    Briefcase,
    Umbrella,
    Backpack,
    Stethoscope,
    HeartPulse,
} from "lucide-react";

// icon = icon color, tile = tinted square behind the icon (light + dark)
const BELT_ITEMS = [
    { label: "Books", Icon: BookOpen, icon: "text-sky-600 dark:text-sky-300", tile: "bg-sky-100 ring-sky-300/70 dark:bg-sky-400/15 dark:ring-sky-300/30" },
    { label: "Calculators", Icon: Calculator, icon: "text-pink-600 dark:text-pink-300", tile: "bg-pink-100 ring-pink-300/70 dark:bg-pink-400/15 dark:ring-pink-300/30" },
    { label: "Laptops & gadgets", Icon: Laptop, icon: "text-indigo-600 dark:text-indigo-300", tile: "bg-indigo-100 ring-indigo-300/70 dark:bg-indigo-400/15 dark:ring-indigo-300/30" },
    { label: "Lab coats", Icon: Shirt, icon: "text-amber-600 dark:text-amber-200", tile: "bg-amber-100 ring-amber-300/70 dark:bg-amber-300/15 dark:ring-amber-200/30" },
    { label: "Lab equipment", Icon: FlaskConical, icon: "text-lime-600 dark:text-lime-300", tile: "bg-lime-100 ring-lime-300/70 dark:bg-lime-400/15 dark:ring-lime-300/30" },
    { label: "Drafting tools", Icon: PencilRuler, icon: "text-cyan-600 dark:text-cyan-300", tile: "bg-cyan-100 ring-cyan-300/70 dark:bg-cyan-400/15 dark:ring-cyan-300/30" },
    { label: "Art supplies", Icon: Palette, icon: "text-fuchsia-600 dark:text-fuchsia-300", tile: "bg-fuchsia-100 ring-fuchsia-300/70 dark:bg-fuchsia-400/15 dark:ring-fuchsia-300/30" },
    { label: "Tools", Icon: Wrench, icon: "text-slate-600 dark:text-slate-200", tile: "bg-slate-200 ring-slate-300/80 dark:bg-slate-300/15 dark:ring-slate-200/30" },
    { label: "Cameras", Icon: Camera, icon: "text-violet-600 dark:text-violet-300", tile: "bg-violet-100 ring-violet-300/70 dark:bg-violet-400/15 dark:ring-violet-300/30" },
    { label: "Business attire", Icon: Briefcase, icon: "text-yellow-600 dark:text-yellow-300", tile: "bg-yellow-100 ring-yellow-300/70 dark:bg-yellow-400/15 dark:ring-yellow-300/30" },
    { label: "Umbrellas", Icon: Umbrella, icon: "text-red-600 dark:text-red-300", tile: "bg-red-100 ring-red-300/70 dark:bg-red-400/15 dark:ring-red-300/30" },
    { label: "School supplies", Icon: Backpack, icon: "text-orange-600 dark:text-orange-300", tile: "bg-orange-100 ring-orange-300/70 dark:bg-orange-400/15 dark:ring-orange-300/30" },
    { label: "Nursing", Icon: Stethoscope, icon: "text-teal-600 dark:text-teal-300", tile: "bg-teal-100 ring-teal-300/70 dark:bg-teal-400/15 dark:ring-teal-300/30" },
    { label: "Medical supplies", Icon: HeartPulse, icon: "text-rose-600 dark:text-rose-300", tile: "bg-rose-100 ring-rose-300/70 dark:bg-rose-400/15 dark:ring-rose-300/30" },
];

const STEPS = [
    { title: "Find what you need", body: "Search, or tap a tag below to narrow it down." },
    { title: "Message the owner", body: "Agree on a pickup spot and a return date." },
    { title: "Return it on time", body: "So the next student can borrow it too." },
];

function BeltTile({ item }) {
    const { label, Icon, icon, tile } = item;
    return (
        <div className="flex w-28 shrink-0 select-none flex-col items-center gap-2.5 rounded-2xl border border-stone-300 bg-white px-3 py-3.5 text-center shadow-md shadow-emerald-900/10 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-lg dark:shadow-black/20 dark:backdrop-blur-sm sm:w-32">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${tile}`}>
                <Icon size={22} className={icon} aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold leading-tight text-neutral-800 dark:text-emerald-50">
                {label}
            </span>
        </div>
    );
}

export default function RentalsBanner({ count }) {
    const showCount = typeof count === "number" && count > 0;

    return (
        <section aria-label="Rentals" className="mb-6 md:mb-8">
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

                    <div className="relative grid gap-8 p-5 sm:p-8 md:p-10 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-12">
                        {/* Headline */}
                        <div className="min-w-0">
                            <h1 className="bg-gradient-to-b from-emerald-900 to-emerald-600 bg-clip-text font-serif text-6xl font-black leading-none tracking-tight text-transparent dark:from-amber-50 dark:to-amber-200 sm:text-7xl lg:text-8xl">
                                Rentals
                            </h1>
                            <p className="mt-4 max-w-md text-lg font-medium leading-snug text-neutral-700 dark:text-emerald-50/85 sm:text-xl">
                                Borrow textbooks, equipment and gear from fellow OLFU students.
                            </p>
                            {showCount && (
                                <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-amber-400 px-3.5 py-1.5 text-xs font-bold text-black shadow-md shadow-amber-500/20">
                                    <span className="h-2 w-2 rounded-full bg-emerald-700 animate-pulse" />
                                    {count} {count === 1 ? "item" : "items"} available now
                                </p>
                            )}
                        </div>

                        {/* How it works */}
                        <ol className="space-y-3.5 rounded-2xl border border-stone-300 bg-white/80 p-4 shadow-lg shadow-emerald-900/10 backdrop-blur-md dark:border-white/10 dark:bg-white/[0.05] dark:shadow-xl dark:shadow-black/20 sm:p-5">
                            {STEPS.map((s, i) => (
                                <li key={s.title} className="flex items-start gap-3">
                                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-xs font-bold text-black shadow shadow-amber-500/30">
                                        {i + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-neutral-900 dark:text-white">
                                            {s.title}
                                        </p>
                                        <p className="text-xs text-neutral-600 dark:text-emerald-50/70 sm:text-sm">
                                            {s.body}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>

                    {/* Conveyor belt: decorative, not clickable, always moving */}
                    <div aria-hidden="true" className="pointer-events-none relative pb-5 sm:pb-6">
                        <div
                            className="overflow-hidden"
                            style={{
                                WebkitMaskImage:
                                    "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
                                maskImage:
                                    "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)",
                            }}
                        >
                            <div className="rb-belt flex w-max gap-3 pb-3 pt-1">
                                {[0, 1, 2].map((copy) =>
                                    BELT_ITEMS.map((item) => (
                                        <BeltTile key={`${copy}-${item.label}`} item={item} />
                                    ))
                                )}
                            </div>
                            <div className="border-b-2 border-dashed border-amber-500/60 dark:border-amber-400/50" />
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .rb-belt { animation: rb-roll 70s linear infinite; }
                @keyframes rb-roll {
                    from { transform: translateX(0); }
                    to { transform: translateX(-33.3333%); }
                }
            `}</style>
        </section>
    );
}