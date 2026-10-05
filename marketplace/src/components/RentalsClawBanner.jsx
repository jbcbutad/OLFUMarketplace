"use client";

// Decorative claw-machine banner for the top of /rentals. It is only a game:
// nothing in here links anywhere or touches Supabase.
import { useEffect, useRef } from "react";
import { Fraunces, Poppins } from "next/font/google";
import "./RentalsClawBanner.css";

const fraunces = Fraunces({
    subsets: ["latin"],
    axes: ["opsz"],
    variable: "--font-fraunces",
    display: "swap",
});

const poppins = Poppins({
    subsets: ["latin"],
    weight: ["500", "600", "700", "800"],
    variable: "--font-poppins",
    display: "swap",
});

const INTRO =
    "Rentals keep rolling by on the belt. Line the claw up over one, then press the red button.";

export default function RentalsClawBanner() {
    const rootRef = useRef(null);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const ac = new AbortController();
        const signal = ac.signal;
        let dead = false;

        const $ = s => root.querySelector(s);
        const glass = $("#glass"), claw = $("#claw"), cable = $("#cable"), car = $("#car"), al = $("#al"), ar = $("#ar"), msg = $("#msg"), trayEl = $("#tray"), banner = root;
        const calc = (b, s, k) => '<svg viewBox="0 0 64 88"><rect width="64" height="88" rx="8" fill="' + b + '"/><rect x="8" y="8" width="48" height="18" rx="3" fill="' + s + '"/><g fill="' + k + '">' + [34, 50, 66].map(y => [8, 25.5, 43].map(x => '<rect x="' + x + '" y="' + y + '" width="13" height="11" rx="3"/>').join("")).join("") + '</g></svg>';
        const SPEC = [
            { name: "Casio MS-20UC calculator", price: 350, w: 64, h: 88, rot: -5, dy: 2, svg: calc("#3B82A8", "#D3E6D6", "#9CCDE3") },
            { name: "Pink Waltons calculator", price: 180, w: 64, h: 88, rot: 4, dy: -2, svg: calc("#F0467F", "#DDEBD8", "rgba(255,255,255,.88)") },
            { name: "Clearbook for rent", price: 20, w: 64, h: 88, rot: -3, dy: 3, svg: '<svg viewBox="0 0 64 88"><rect width="64" height="88" rx="5" fill="#19B3A6"/><rect x="12" y="14" width="42" height="32" rx="3" fill="#fff" fill-opacity=".85"/><g fill="#0A3D24"><circle cx="0" cy="14" r="4"/><circle cx="0" cy="34" r="4"/><circle cx="0" cy="54" r="4"/><circle cx="0" cy="74" r="4"/></g></svg>' },
            { name: "OLFU uniform", price: 120, w: 76, h: 80, rot: -4, dy: 0, svg: '<svg viewBox="0 0 80 84"><path d="M22 6 L4 22 L13 38 L22 32 V78 Q22 80 24 80 H56 Q58 80 58 78 V32 L67 38 L76 22 L58 6 Q40 26 22 6 Z" fill="#F4F7F2" stroke="#C3CFC6" stroke-width="1.5" stroke-linejoin="round"/><path d="M22 6 L32 4 L40 20 L30 22 Z" fill="#0F6E3F"/><path d="M58 6 L48 4 L40 20 L50 22 Z" fill="#0F6E3F"/><path d="M4 22 L13 38 L18 35.500 L9 20 Z" fill="#0F6E3F"/><path d="M76 22 L67 38 L62 35.500 L71 20 Z" fill="#0F6E3F"/><path d="M40 20 V58" stroke="#C3CFC6" stroke-width="1.500"/><g fill="#9AA89D"><circle cx="40" cy="30" r="1.600"/><circle cx="40" cy="40" r="1.600"/><circle cx="40" cy="50" r="1.600"/></g><circle cx="30" cy="42" r="6" fill="#E8B72A"/><circle cx="30" cy="42" r="2.500" fill="#0F6E3F"/></svg>' },
            { name: "Tote bag", price: 150, w: 74, h: 80, rot: 6, dy: 0, svg: '<svg viewBox="0 0 74 80"><path d="M22 24 Q22 4 37 4 Q52 4 52 24" fill="none" stroke="#B9A57F" stroke-width="5" stroke-linecap="round"/><path d="M4 22 H70 L64 74 Q63 78 59 78 H15 Q11 78 10 74 Z" fill="#E3D3AE"/></svg>' },
            { name: "Textbook", price: 60, w: 60, h: 84, rot: 3, dy: 1, svg: '<svg viewBox="0 0 64 88"><rect width="64" height="88" rx="4" fill="#2F5DA8"/><rect width="8" height="88" rx="3" fill="#1E3F78"/><rect x="18" y="14" width="38" height="24" rx="3" fill="#F2C94C"/><rect x="18" y="48" width="32" height="5" rx="2" fill="#fff" fill-opacity=".85"/><rect x="18" y="58" width="22" height="5" rx="2" fill="#fff" fill-opacity=".85"/></svg>' },
            { name: "Lab gown", price: 100, w: 74, h: 85, rot: -3, dy: 0, svg: '<svg viewBox="0 0 80 92"><path d="M24 6 L6 20 L12 42 L24 36 V88 H56 V36 L68 42 L74 20 L56 6 L40 32 Z" fill="#fff" stroke="#C3CFC6" stroke-width="1.5" stroke-linejoin="round"/><path d="M24 6 L40 32 L33 50 L24 36 Z" fill="#E6EEE8"/><path d="M56 6 L40 32 L47 50 L56 36 Z" fill="#E6EEE8"/><rect x="26" y="62" width="12" height="14" rx="2" fill="none" stroke="#C3CFC6" stroke-width="1.5"/><rect x="42" y="62" width="12" height="14" rx="2" fill="none" stroke="#C3CFC6" stroke-width="1.5"/><circle cx="40" cy="48" r="1.8" fill="#9AA89D"/><circle cx="40" cy="62" r="1.8" fill="#9AA89D"/><circle cx="40" cy="76" r="1.8" fill="#9AA89D"/></svg>' },
            { name: "Umbrella", price: 30, w: 72, h: 76, rot: 5, dy: -1, svg: '<svg viewBox="0 0 80 84"><path d="M4 42 Q40 -8 76 42 Q64 34 52 42 Q40 34 28 42 Q16 34 4 42 Z" fill="#FF7A59"/><path d="M40 6 V42 M24 20 Q30 36 28 42 M56 20 Q50 36 52 42" stroke="#C9553A" stroke-width="2" fill="none"/><path d="M40 42 V68 Q40 80 29 78" fill="none" stroke="#3B2F2F" stroke-width="5" stroke-linecap="round"/></svg>' },
            { name: "Backpack", price: 90, w: 66, h: 80, rot: -2, dy: 0, svg: '<svg viewBox="0 0 70 84"><path d="M25 12 Q25 0 35 0 Q45 0 45 12" fill="none" stroke="#1B3550" stroke-width="5" stroke-linecap="round"/><rect x="4" y="10" width="62" height="74" rx="20" fill="#25476A"/><rect x="14" y="44" width="42" height="30" rx="8" fill="#3B6E9C"/><path d="M14 44 H56" stroke="#E8B72A" stroke-width="3"/><rect x="26" y="52" width="18" height="4" rx="2" fill="#E8B72A"/></svg>' }
        ];
        const NOTE = "Just a game! To borrow something for real, click a rental in the listings below and send a request to borrow it.";
        const items = SPEC.map(s => { const el = document.createElement("div"); el.className = "it"; el.innerHTML = s.svg; glass.appendChild(el); return Object.assign({ el, taken: false, x: 0, y: 0, cxp: 0 }, s) });
        const REST = 16;
        let GW = 0, GH = 0, sc = 1, floorY = 0, chuteX = 43, cx = 0, cy = REST, busy = false, carried = null, swing = 0;
        const clamp = v => Math.max(30, Math.min(GW - 30, v));
        const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const anim = (ms, fn) => new Promise(res => { const t0 = performance.now(); (function f(t) { const k = Math.min(1, (t - t0) / ms); fn(k); k < 1 && !dead ? requestAnimationFrame(f) : res() })(t0) });
        const tw = (a, b, ms, set) => anim(Math.max(120, ms), k => set(a + (b - a) * ease(k)));
        const say = t => { msg.textContent = t };

        function paintItem(it, x, y, r) { it.el.style.transform = "translate(" + x + "px," + y + "px) rotate(" + r + "deg)" }
        let offset = 0, speed = 0, beltL = 0, beltLeft = 0;
        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, floorEl = $(".floor");
        function place() {
            GW = glass.clientWidth; GH = glass.clientHeight; sc = GW < 460 ? .6 : .88; floorY = GH - 22;
            const cw = matchMedia("(max-width:820px)").matches ? 70 : 86; chuteX = cw / 2;
            beltLeft = cw + 30; beltL = Math.max(items.length * 104 * sc, GW - beltLeft + 120);
            items.forEach((it, i) => {
                it.sw = it.w * sc; it.sh = it.h * sc; it.el.style.width = it.sw + "px";
                it.u0 = (i + .6) * beltL / items.length; it.op = -1;
                it.el.style.display = it.taken ? "none" : "block";
            });
            cx = clamp(cx || GW * .5); tickItems(0); draw();
        }
        function tickItems(t) {
            items.forEach((it, i) => {
                if (it.taken || it.locked) return;
                const u = (((it.u0 - offset) % beltL) + beltL) % beltL;
                it.cxp = beltLeft + u; it.x = it.cxp - it.sw / 2;
                it.y = floorY - it.sh + it.dy + (reduce ? 0 : Math.sin(t / 260 + i * 1.7) * 1.6);
                const op = u < 50 ? u / 50 : 1;
                if (Math.abs(op - it.op) > .01) { it.op = op; it.el.style.opacity = op }
                paintItem(it, it.x, it.y, it.rot + (reduce ? 0 : Math.sin(t / 340 + i) * 1.2));
            });
        }
        let lastT = performance.now();
        function tick(t) {
            if (dead) return;
            const dt = Math.min(.05, (t - lastT) / 1000); lastT = t;
            const target = (busy || reduce) ? 0 : 38;
            speed += (target - speed) * Math.min(1, dt * 3);
            offset += speed * dt;
            tickItems(t);
            floorEl.style.backgroundPosition = (-(offset % 28)) + "px 0";
            requestAnimationFrame(tick);
        }
        function draw() {
            claw.style.transform = "translate(" + (cx - 30) + "px," + cy + "px)";
            cable.style.transform = "translateX(" + (cx - 1.5) + "px)"; cable.style.height = (cy + 10) + "px";
            car.style.transform = "translateX(" + (cx - 17) + "px)";
            if (carried) { paintItem(carried, cx - carried.sw / 2, cy + 30, Math.sin(performance.now() / 160) * swing) }
        }
        function setArms(a) { al.setAttribute("transform", "rotate(" + a + " 24 10)"); ar.setAttribute("transform", "rotate(" + (-a) + " 36 10)") }

        async function grab() {
            const left = items.filter(i => !i.taken);
            if (busy || !left.length) return;
            busy = true; speed = 0; say("Grabbing…");
            const vis = left.filter(i => i.op > .7 && i.cxp > 24 && i.cxp < GW - 24);
            const near = (vis.length ? vis : left).map(i => ({ i, d: Math.abs(i.cxp - cx) })).sort((a, b) => a.d - b.d)[0];
            const hit = near.d < near.i.sw / 2 + 8 ? near.i : null;
            const tgt = hit ? hit.y - 24 : floorY - 84;
            await tw(cy, tgt, (tgt - cy) / .26, v => { cy = v; draw() });
            await tw(24, hit ? 6 : 1, 300, setArms);
            if (hit) { carried = hit; hit.locked = true; hit.op = 1; hit.el.style.opacity = 1; swing = 3; hit.el.style.zIndex = 3 }
            await tw(cy, REST, (cy - REST) / .28, v => { cy = v; draw() });
            if (hit) {
                await tw(cx, chuteX, Math.abs(cx - chuteX) / .32 + 150, v => { cx = v; draw() });
                swing = 0; await tw(6, 24, 260, setArms);
                carried = null; const y0 = cy + 30, y1 = floorY - hit.sh;
                await tw(y0, y1, 380, v => paintItem(hit, chuteX - hit.sw / 2, v, 0));
                hit.el.style.transition = "opacity .3s"; hit.el.style.opacity = 0;
                setTimeout(() => { hit.el.style.display = "none"; hit.el.style.transition = ""; hit.el.style.zIndex = 2 }, 320);
                hit.taken = true; renderTray();
                say(items.every(i => i.taken) ? "You cleared the machine. Request your haul or refill it." : "Got it. " + hit.name + " is in your tray.");
            } else {
                await tw(1, 24, 260, setArms);
                say(near.d < 110 ? "So close. Nudge the claw until it sits right over the rental." : "Missed. Line the claw up over a rental first.");
            }
            busy = false;
        }
        function renderTray() {
            const got = items.filter(i => i.taken);
            trayEl.innerHTML = got.map(i => '<span class="chip" title="' + i.name + '"><i>' + i.svg + '</i>₱' + i.price + '</span>').join("") +
                (got.length ? '<button type="button" class="req" id="rcb-req">Request ' + got.length + '</button><button type="button" class="refill" id="refill">Refill</button>' : "");
            const r = $("#refill"); if (r) r.onclick = () => { items.forEach(i => { i.taken = false; i.locked = false; i.el.style.opacity = 1 }); place(); renderTray(); say("Machine refilled. Go again.") };
            const q = $("#rcb-req"); if (q) q.onclick = () => say(NOTE);
        }

        function nudge(d) { if (!busy && !dead) { cx = clamp(cx + d); draw() } }
        function hold(btn, dir) { let id; signal.addEventListener("abort", () => clearInterval(id)); btn.addEventListener("pointerdown", e => { e.preventDefault(); nudge(dir * 8); id = setInterval(() => nudge(dir * 8), 16) }, { signal });["pointerup", "pointerleave", "pointercancel"].forEach(ev => btn.addEventListener(ev, () => clearInterval(id), { signal })) }
        hold($("#bl"), -1); hold($("#br"), 1);
        $("#go").addEventListener("click", grab, { signal });
        glass.addEventListener("pointermove", e => { if (e.pointerType === "mouse" && !busy) { cx = clamp(e.clientX - glass.getBoundingClientRect().left); draw() } }, { signal });
        glass.addEventListener("pointerdown", e => { if (busy) return; cx = clamp(e.clientX - glass.getBoundingClientRect().left); draw(); if (e.pointerType === "mouse") grab() }, { signal });
        banner.addEventListener("keydown", e => {
            if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-18) }
            else if (e.key === "ArrowRight") { e.preventDefault(); nudge(18) }
            else if (e.target === banner && (e.key === " " || e.key === "Enter")) { e.preventDefault(); grab() }
        }, { signal });
        window.addEventListener("resize", place, { signal });
        setArms(24); place(); requestAnimationFrame(tick);

        return () => { dead = true; ac.abort(); items.forEach(i => i.el.remove()) };
    }, []);

    return (
        <div className="rcb-wrap">
            <section
                ref={rootRef}
                className={`rcb ${fraunces.variable} ${poppins.variable}`}

                tabIndex={0}
                aria-labelledby="rcb-title"
            >
                <div className="copy">
                    <h1 id="rcb-title">Rentals</h1>
                    <p className="sub">Borrow textbooks, equipment and gear from fellow OLFU students.</p>
                    <div className="say" id="msg" aria-live="polite">{INTRO}</div>
                    <p className="keys">
                        Mouse: move and click. Touch: tap to aim, then press Grab. Keyboard: arrow keys and Space.
                    </p>
                </div>

                <div className="cab">
                    <div className="mq">
                        <div className="bulbs" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
                        Grab a rental
                        <div className="bulbs" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
                    </div>
                    <div className="glass" id="glass">
                        <div className="rail" />
                        <div className="car" id="car" />
                        <div className="cable" id="cable" />
                        <div className="claw" id="claw">
                            <svg viewBox="0 0 60 56" aria-hidden="true">
                                <rect x="18" y="0" width="24" height="12" rx="4" fill="#E8B72A" />
                                <g id="al" fill="none" stroke="#DCE3E0" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><path d="M24 10 L12 30 L20 50" /></g>
                                <g id="ar" fill="none" stroke="#DCE3E0" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"><path d="M36 10 L48 30 L40 50" /></g>
                            </svg>
                        </div>
                        <div className="chute">Borrow<br />here</div>
                        <div className="floor" />
                    </div>
                    <div className="deck">
                        <button type="button" className="mv" id="bl" aria-label="Move claw left">&#9664;</button>
                        <button type="button" className="mv" id="br" aria-label="Move claw right">&#9654;</button>
                        <button type="button" className="go" id="go">Grab</button>
                        <div className="tray" id="tray" />
                    </div>
                </div>
            </section>
        </div>
    );
}