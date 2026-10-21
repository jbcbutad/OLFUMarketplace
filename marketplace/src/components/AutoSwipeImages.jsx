"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Image slider: auto-swipes, plus arrows, clickable dots and touch swipe.
 * Safe to place inside a <Link> card (buttons stop the link from firing).
 */
export default function AutoSwipeImages({
    images = [],
    interval = 3500,
    className = "",
}) {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const touchStartX = useRef(null);
    const count = images.length;

    // Auto-advance. Re-runs whenever `index` changes, so a manual click
    // restarts the timer instead of swiping again a moment later.
    useEffect(() => {
        if (count < 2 || paused) return;
        const id = setTimeout(() => setIndex((i) => (i + 1) % count), interval);
        return () => clearTimeout(id);
    }, [index, paused, count, interval]);

    const go = (e, next) => {
        e.preventDefault();  // don't follow the card's <Link>
        e.stopPropagation();
        setIndex((next + count) % count);
    };

    // Touch swipe (phones)
    const onTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
        setPaused(true);
    };
    const onTouchEnd = (e) => {
        const start = touchStartX.current;
        touchStartX.current = null;
        setPaused(false);
        if (start == null) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 40) setIndex((i) => (i + (dx < 0 ? 1 : -1) + count) % count);
    };

    const arrowBtn =
        "absolute top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur border border-white/20 hover:bg-black/80 transition-opacity md:opacity-0 md:group-hover:opacity-100 focus:opacity-100";

    return (
        <div
            className={`overflow-hidden ${className}`}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
        >
            <div
                className="flex h-full w-full transition-transform duration-700 ease-in-out"
                style={{ transform: `translateX(-${index * 100}%)` }}
            >
                {images.map((src, i) => (
                    <img
                        key={src}
                        src={src}
                        alt=""
                        draggable={false}
                        loading={i === 0 ? "eager" : "lazy"}
                        className="h-full w-full shrink-0 object-cover object-center"
                    />
                ))}
            </div>

            {count > 1 && (
                <>
                    <button
                        type="button"
                        aria-label="Previous image"
                        onClick={(e) => go(e, index - 1)}
                        className={`${arrowBtn} left-3`}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        type="button"
                        aria-label="Next image"
                        onClick={(e) => go(e, index + 1)}
                        className={`${arrowBtn} right-3`}
                    >
                        <ChevronRight size={18} />
                    </button>

                    <div className="absolute bottom-3 right-4 z-20 flex gap-1.5">
                        {images.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                aria-label={`Go to image ${i + 1}`}
                                onClick={(e) => go(e, i)}
                                className={`h-2 rounded-full transition-all duration-500 ${i === index ? "w-5 bg-white" : "w-2 bg-white/40 hover:bg-white/70"
                                    }`}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
