"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Fraunces, Poppins } from "next/font/google";
import "./olfu-banner.css";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["900"], variable: "--font-fraunces" });
const poppins = Poppins({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-poppins" });

const SLIDES = [
    {
        title: "Proud to be a Fatimanian.",
        text: "Official OLFU merch, made for you.",
        cta: "Shop merch",
        bgImage: "campus.png",
    },
    {
        title: "Merch for every college.",
        text: "Wear your college pride.",
        cta: "Find yours",
        bgImage: "campus.png",
        seals: ["seal-crim", "seal-nursing", "seal-pharmacy", "seal-pt", "seal-education", "seal-ccs"],
    },
    {
        title: "Gear up, Fatimanian.",
        text: "Everyday OLFU essentials for campus and beyond.",
        cta: "See more",
        bgImage: "campus.png",
        lanyards: ["lan-comsci", "lan-nursing", "lan-pharmacy"],
    },
];

export default function OlfuMerchBanner({
    merchUrl = "/merchandise",
    imageBase = "/",
    interval = 2500,
    className = "", // size + shape come from here, e.g. "h-56 sm:h-64 rounded-3xl"
    slides = SLIDES,
}) {
    const [idx, setIdx] = useState(0);
    const pausedRef = useRef(false);
    const touchX = useRef(null);
    const count = slides.length;

    const img = (name) => `${imageBase}${name}${name.includes(".") ? "" : ".png"}`;
    const go = useCallback((i) => setIdx(((i % count) + count) % count), [count]);

    // autoplay (restarts whenever the slide changes, so manual clicks reset the timer)
    useEffect(() => {
        if (count < 2) return;
        const t = setInterval(() => {
            if (!pausedRef.current && !document.hidden) setIdx((i) => (i + 1) % count);
        }, interval);
        return () => clearInterval(t);
    }, [idx, count, interval]);

    return (
        <section
            className={`omb play ${fraunces.variable} ${poppins.variable} ${className}`}
            aria-roledescription="carousel"
            aria-label="OLFU merchandise"
            onMouseEnter={() => (pausedRef.current = true)}
            onMouseLeave={() => (pausedRef.current = false)}
            onFocus={() => (pausedRef.current = true)}
            onBlur={() => (pausedRef.current = false)}
            onKeyDown={(e) => {
                if (e.key === "ArrowLeft") go(idx - 1);
                if (e.key === "ArrowRight") go(idx + 1);
            }}
            onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
                if (touchX.current == null) return;
                const dx = e.changedTouches[0].clientX - touchX.current;
                if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1));
                touchX.current = null;
            }}
        >
            {slides.map((s, i) => {
                const on = i === idx;
                const bg = s.bgImage
                    ? `linear-gradient(90deg,rgba(255,255,255,.93) 0,rgba(255,255,255,.82) 40%,rgba(255,255,255,0) 75%),url(${img(s.bgImage)}) center 76%/cover`
                    : "#fff";
                return (
                    <div
                        key={i}
                        className={`omb-slide${on ? " on" : ""}`}
                        role="group"
                        aria-label={`${i + 1} of ${count}`}
                        aria-hidden={!on}
                        style={{ background: bg }}
                    >
                        <div className="omb-copy">
                            <h2 className="omb-title">{s.title}</h2>
                            <p className="omb-text">{s.text}</p>
                            <Link className="omb-cta" href={merchUrl} tabIndex={on ? 0 : -1}>
                                {s.cta}
                            </Link>
                        </div>

                        <div className="omb-art">
                            {s.lanyards ? (
                                <div className="omb-lan">
                                    {s.lanyards.map((n) => (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img key={n} alt="" src={img(n)} />
                                    ))}
                                </div>
                            ) : s.seals ? (
                                <div className="omb-orbit">
                                    <div className="omb-core">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img alt="" src={img("seal-veritas")} />
                                    </div>
                                    <div className="omb-ring">
                                        {s.seals.map((n, k) => (
                                            <span key={n} className="omb-seal" style={{ "--a": `${k * 60}deg` }}>
                                                <span className="omb-chip">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img alt="" src={img(n)} />
                                                </span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                );
            })}

            <button className="omb-arrow omb-prev" aria-label="Previous slide" onClick={() => go(idx - 1)}>
                &#8249;
            </button>
            <button className="omb-arrow omb-next" aria-label="Next slide" onClick={() => go(idx + 1)}>
                &#8250;
            </button>
            <div className="omb-dots">
                {slides.map((_, i) => (
                    <button
                        key={i}
                        className={`omb-dot${i === idx ? " on" : ""}`}
                        aria-label={`Go to slide ${i + 1}`}
                        onClick={() => go(i)}
                    />
                ))}
            </div>
        </section>
    );
}
