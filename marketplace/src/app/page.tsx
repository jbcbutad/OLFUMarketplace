"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import "./landing.css";

/* ---------- data ---------- */
const WORDS = ["books", "uniforms", "gadgets", "merch"];

const FALLBACK_MARQUEE: [string, string][] = [
    ["Nursing Book 2", "₱500"], ["BSN Duty Uniform", "₱650"], ["Graphing Calculator", "₱1,200"],
    ["OLFU Varsity Jacket", "₱899"], ["Lab Manual", "₱400"], ["USB Headset", "₱350"],
    ["PE Jogging Pants", "₱300"], ["Nursing Theorists", "₱450"],
];

type Item = { cls: string; title: string; price: string; seller: string; cat: string; bg: string; cover: string; tag: string; image?: string };
const FALLBACK_FLOATS: Item[] = [
    { cls: "fc1", title: "Nursing Book 2", price: "₱500", seller: "Raymon Galsim", cat: "Books", bg: "#F3E3C4", cover: "Microbiology", tag: "Books" },
    { cls: "fc2", title: "BSN Duty Uniform", price: "₱650", seller: "Angela Reyes", cat: "Uniforms", bg: "#DCEAE1", cover: "Duty Uniform", tag: "Uniforms" },
    { cls: "fc3", title: "Graphing Calculator", price: "₱1,200", seller: "Kim Dela Cruz", cat: "Electronics", bg: "#DCE0EA", cover: "Casio fx-991", tag: "Electronics" },
    { cls: "fc4", title: "OLFU Varsity Jacket", price: "₱899", seller: "OLFU Supply Office", cat: "Merchandise", bg: "#E8DFF0", cover: "Official Merch", tag: "Merch" },
];

const CATS = [
    { href: "/marketplace?category=Books", bg: "#F3E3C4", ico: "📚", name: "Books", sub: "Textbooks & lab manuals" },
    { href: "/marketplace?category=Uniforms", bg: "#DCEAE1", ico: "🥼", name: "Uniforms", sub: "Duty wear & PE sets" },
    { href: "/marketplace?category=Electronics", bg: "#DCE0EA", ico: "🎧", name: "Electronics", sub: "Calculators & gadgets" },
    { href: "/merchandise", bg: "#E8DFF0", ico: "🎓", name: "Merchandise", sub: "Official OLFU items" },
];


/* ---------- product data ---------- */
// Adjust these if your table/columns are named differently.
const PRODUCTS_TABLE = "products";
const PALETTE = ["#F3E3C4", "#DCEAE1", "#DCE0EA", "#E8DFF0"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = { [key: string]: any };
const peso = (n: unknown) => `₱${Number(n).toLocaleString("en-PH")}`;
const isFlagged = (r: Row) => Array.isArray(r.tags) && r.tags.includes("Flagged");
const rowTitle = (r: Row): string => r.title ?? r.name ?? "Untitled";
const rowImage = (r: Row): string | undefined =>
    (Array.isArray(r.image_urls) ? r.image_urls[0] : r.image_urls) ??
    (Array.isArray(r.images) ? r.images[0] : r.images) ??
    r.image_url ?? r.image ?? undefined;

/** Live listings only: published, available, and approved. */
const liveProducts = () =>
    supabase
        .from(PRODUCTS_TABLE)
        .select("*")
        .eq("is_published", true)
        .eq("is_available", true)
        .eq("status", "active");

/** Newest official-merch listings (skips flagged ones). */
async function fetchFeatured(): Promise<Item[] | null> {
    try {
        const { data, error } = await liveProducts()
            .contains("tags", ["official-merch"])
            .order("created_at", { ascending: false })
            .limit(8);
        if (error) { console.warn("Featured products error:", error.message); return null; }
        const rows = (data ?? []).filter((r: Row) => !isFlagged(r)).slice(0, 4);
        if (!rows.length) return null;
        return rows.map((r: Row, i: number) => ({
            cls: `fc${i + 1}`,
            title: rowTitle(r),
            price: peso(r.price),
            seller: r.seller_name ?? "OLFU Supply Office",
            cat: "Merchandise",
            bg: PALETTE[i % PALETTE.length],
            cover: "Official Merch",
            tag: "Merch",
            image: rowImage(r),
        }));
    } catch (e) {
        console.warn("Featured products failed:", e);
        return null;
    }
}

/** Newest live products for the marquee (skips flagged ones). */
async function fetchMarquee(): Promise<[string, string][] | null> {
    try {
        const { data, error } = await liveProducts()
            .order("created_at", { ascending: false })
            .limit(30);
        if (error) { console.warn("Marquee products error:", error.message); return null; }
        const rows = (data ?? []).filter((r: Row) => !isFlagged(r)).slice(0, 12);
        if (!rows.length) return null;
        return rows.map((r: Row) => [rowTitle(r), peso(r.price)] as [string, string]);
    } catch (e) {
        console.warn("Marquee products failed:", e);
        return null;
    }
}

const categoryHref = (cat: string) =>
    cat === "Merchandise" ? "/merchandise" : `/marketplace?category=${encodeURIComponent(cat)}`;

/* ---------- helpers ---------- */
function Reveal({ className = "", children }: { className?: string; children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (!("IntersectionObserver" in window)) { setShown(true); return; }
        const io = new IntersectionObserver(
            (es) => es.forEach((e) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }),
            { threshold: 0.15 }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    return <div ref={ref} className={`${className} reveal${shown ? " in" : ""}`}>{children}</div>;
}

async function fetchCategoryCount(): Promise<number | null> {
    try {
        const { count, error } = await supabase
            .from("categories")
            .select("id", { count: "exact", head: true });
        if (error) { console.warn("Category count error:", error.message); return null; }
        return count;
    } catch (e) {
        console.warn("Category count failed:", e);
        return null;
    }
}

/** Counts up to `to` once visible. With fromDb, the target comes from the categories table. */
function Counter({ to, fromDb = false }: { to: number; fromDb?: boolean }) {
    const ref = useRef<HTMLSpanElement>(null);
    const [val, setVal] = useState(0);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        let raf = 0;
        let cancelled = false;

        const run = async () => {
            let target = to;
            if (fromDb) {
                const n = await fetchCategoryCount();
                if (n != null) target = n;
            }
            if (cancelled || target === 0) { setVal(target); return; }
            const dur = 900, start = performance.now();
            const tick = (now: number) => {
                const p = Math.min((now - start) / dur, 1);
                setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
                if (p < 1) raf = requestAnimationFrame(tick);
            };
            raf = requestAnimationFrame(tick);
        };

        if (!("IntersectionObserver" in window)) { run(); return; }
        const io = new IntersectionObserver(
            (es) => es.forEach((e) => { if (e.isIntersecting) { io.disconnect(); run(); } }),
            { threshold: 0.15 }
        );
        io.observe(el);
        return () => { cancelled = true; io.disconnect(); cancelAnimationFrame(raf); };
    }, [to, fromDb]);

    return <span ref={ref}>{val}</span>;
}

function Check() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M20 6L9 17l-5-5" />
        </svg>
    );
}

/* ---------- page ---------- */
export default function LandingPage() {
    const [theme, setTheme] = useState<"light" | "dark" | undefined>(undefined);
    const [wi, setWi] = useState(0);
    const [wordVisible, setWordVisible] = useState(true);
    const [selected, setSelected] = useState<Item | null>(null);
    const [floats, setFloats] = useState<Item[]>(FALLBACK_FLOATS);
    const [marquee, setMarquee] = useState<[string, string][]>(FALLBACK_MARQUEE);
    const bandRef = useRef<HTMLDivElement>(null);
    const glowRef = useRef<HTMLDivElement>(null);

    // restore saved theme
    useEffect(() => {
        try {
            const s = localStorage.getItem("olfu-theme");
            if (s === "light" || s === "dark") setTheme(s);
        } catch { }
    }, []);

    const toggleTheme = () => {
        const dark = theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
        const next = dark ? "light" : "dark";
        setTheme(next);
        try { localStorage.setItem("olfu-theme", next); } catch { }
    };

    // rotating word
    useEffect(() => {
        let t: ReturnType<typeof setTimeout>;
        const id = setInterval(() => {
            setWordVisible(false);
            t = setTimeout(() => { setWi((i) => (i + 1) % WORDS.length); setWordVisible(true); }, 250);
        }, 2400);
        return () => { clearInterval(id); clearTimeout(t); };
    }, []);

    // load live products (falls back to the sample data if anything fails)
    useEffect(() => {
        let alive = true;
        fetchFeatured().then((f) => { if (alive && f) setFloats(f); });
        fetchMarquee().then((m) => { if (alive && m) setMarquee(m); });
        return () => { alive = false; };
    }, []);

    // Esc closes the quick view
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    const onMove = (e: React.MouseEvent) => {
        const band = bandRef.current, glow = glowRef.current;
        if (!band || !glow) return;
        const r = band.getBoundingClientRect();
        glow.style.opacity = "1";
        glow.style.left = e.clientX - r.left + "px";
        glow.style.top = e.clientY - r.top + "px";
    };
    const onLeave = () => { if (glowRef.current) glowRef.current.style.opacity = "0"; };

    const chips = marquee.map(([n, p]) => ({ n, p }));

    return (
        <div className="olfu" data-theme={theme}>
            <div className="topbar">
                <div className="brand"><span className="mark">O</span> OLFU Marketplace</div>
                <div className="topbar-actions">
                    <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle dark mode">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <circle cx="12" cy="12" r="4" />
                            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                        </svg>
                    </button>
                    <Link className="btn" href="/login">Log in</Link>
                </div>
            </div>

            <div className="hero-band" ref={bandRef} onMouseMove={onMove} onMouseLeave={onLeave}>
                <div className="glow" ref={glowRef} />
                <div className="wrap">
                    <div className="hero">
                        <div>
                            <div className="pill"><i /> Exclusive to OLFU Valenzuela</div>
                            <h1>
                                Your campus, your marketplace for{" "}
                                <span className="rot" style={{ transition: "opacity .25s", opacity: wordVisible ? 1 : 0 }}>{WORDS[wi]}</span>.
                            </h1>
                            <p>Buy, sell, and pass things on with verified OLFU students. Textbooks, uniforms, and gadgets change hands every term — now in one safe place.</p>
                            <div className="hero-ctas">
                                <Link className="btn gold large" href="/login">Login with OLFU email</Link>
                                <Link className="btn ghost large" href="/marketplace">Browse listings →</Link>
                            </div>
                        </div>
                        <div className="hero-visual">
                            {floats.map((f) => (
                                <div key={f.title} className={`float-card ${f.cls}`} onClick={() => setSelected(f)}>
                                    <div
                                        className="float-cover"
                                        style={{
                                            background: f.image ? `${f.bg} url("${f.image}") center / cover no-repeat` : f.bg,
                                        }}
                                    >
                                        {!f.image && f.cover}
                                    </div>
                                    <div className="t">{f.title}</div>
                                    <div className="p">{f.price} <small>{f.tag}</small></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="marquee">
                <div className="track">
                    {[...chips, ...chips].map((c, i) => (
                        <div className="mchip" key={i}>{c.n} <b>{c.p}</b></div>
                    ))}
                </div>
            </div>

            <div className="wrap">
                <Reveal className="stats">
                    <div className="stat"><b><Counter to={4} fromDb /></b><span>Item categories</span></div>
                    <div className="stat"><b>OLFU-only</b><span>Verified accounts</span></div>
                    <div className="stat"><b>₱<Counter to={0} /></b><span>Platform fees</span></div>
                    <div className="stat"><b><Counter to={3} /> steps</b><span>Post to hand-off</span></div>
                </Reveal>
            </div>

            <section className="block">
                <div className="wrap">
                    <Reveal className="head">
                        <p className="eyebrow">How it works</p>
                        <h2>Trading with classmates, without the hassle</h2>
                        <p>No shipping and no payment processing — students trade directly, arranged through chat.</p>
                    </Reveal>
                    <Reveal className="bento">
                        <div className="tile t1">
                            <h3>Chat that keeps itself clean</h3>
                            <p>Message buyers and sellers in-app. AI moderation flags anything harmful or inappropriate before it becomes a problem.</p>
                            <div className="chatdemo">
                                <div className="bubble a">Hi! Is the Nursing Book 2 still available?</div>
                                <div className="bubble b">Yes! Can meet at the library, 3 PM.</div>
                                <div className="bubble warn">🛡️ AI moderation active on this chat</div>
                            </div>
                            <span className="num">02</span>
                        </div>
                        <div className="tile t2"><h3>Post in a minute</h3><p>Add photos, a price, pick a category. Verified partners can list official merch.</p><span className="num">01</span></div>
                        <div className="tile t3"><h3>Meet up on campus</h3><p>Agree on a time and place, then settle payment however works for both of you.</p><span className="num">03</span></div>
                        <div className="tile t4"><h3>Search your way</h3><p>Type, speak, or search by image, with smart suggestions as you go.</p></div>
                        <div className="tile t5"><h3>Filter fast</h3><p>Narrow by category and price to find exactly what fits your semester.</p></div>
                        <div className="tile t6"><h3>Manage listings</h3><p>Edit or remove your own posts anytime from one place.</p></div>
                    </Reveal>
                </div>
            </section>

            <section className="block" style={{ paddingTop: 0 }}>
                <div className="wrap">
                    <Reveal className="head">
                        <p className="eyebrow">Browse by category</p>
                        <h2>What&apos;s moving around campus this term</h2>
                    </Reveal>
                    <Reveal className="cats">
                        {CATS.map((c) => (
                            <Link key={c.name} className="cat" href={c.href} style={{ background: c.bg }}>
                                <div className="go">↗</div>
                                <div className="ico">{c.ico}</div>
                                <div><span>{c.name}</span><small>{c.sub}</small></div>
                            </Link>
                        ))}
                    </Reveal>
                </div>
            </section>

            <section className="block" style={{ paddingTop: 0 }}>
                <div className="wrap">
                    <Reveal className="trust">
                        <div>
                            <p className="eyebrow">Trust &amp; safety</p>
                            <h2>Built for the OLFU community, not the open internet</h2>
                            <p>Every account is verified through an OLFU credential and email, so listings stay within the community they&apos;re meant for.</p>
                        </div>
                        <div className="badge-list">
                            <div className="badge"><Check />OLFU-credential login &amp; email verification</div>
                            <div className="badge"><Check />AI moderation on buyer–seller messages</div>
                            <div className="badge"><Check />Only approved partners sell official merchandise</div>
                        </div>
                    </Reveal>
                </div>
            </section>

            <div className="cta-band">
                <h2>Ready to see what&apos;s listed?</h2>
                <p>Register with your OLFU email to start posting, or browse first as a guest.</p>
                <div className="hero-ctas" style={{ justifyContent: "center" }}>
                    <Link className="btn gold large" href="/login">Register</Link>
                    <Link className="btn ghost large" href="/marketplace">Browse listings →</Link>
                </div>
            </div>
            <footer>
                OLFU Valenzuela Marketplace — a student-to-student platform for the OLFU Valenzuela community. This is a student capstone project and is not an official service of Our Lady of Fatima University.
                <div style={{ marginTop: 8, display: "flex", justifyContent: "center", gap: 16 }}>
                    <Link href="/privacy" style={{ textDecoration: "underline", color: "inherit" }}>Privacy Policy</Link>
                    <Link href="/terms" style={{ textDecoration: "underline", color: "inherit" }}>Terms of Service</Link>
                </div>
            </footer>

            <div className={`backdrop${selected ? " open" : ""}`} onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
                {selected && (
                    <div className="modal">
                        <div className="modal-cover" style={{ background: selected.image ? `${selected.bg} url("${selected.image}") center / cover no-repeat` : selected.bg }}>
                            <button className="modal-close" aria-label="Close" onClick={() => setSelected(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <h3>{selected.title}</h3>
                            <div className="modal-price">{selected.price}</div>
                            <div className="modal-seller">Listed by {selected.seller}</div>
                            <div className="modal-actions">
                                <button className="btn" onClick={() => setSelected(null)}>Close</button>
                                <Link className="btn primary" href={categoryHref(selected.cat)}>View in {selected.cat}</Link>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}