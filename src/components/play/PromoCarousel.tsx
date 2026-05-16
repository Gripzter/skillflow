"use client";

import { useCallback, useEffect, useRef, useState, type TouchEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { PROMO_SLIDES, type PromoSlide } from "@/lib/promoSlides";

const DWELL_MS = 5000;
const TRANSITION_MS = 600;

function Slide({ slide, active }: { slide: PromoSlide; active: boolean }) {
  const accentColor = slide.accentColor ?? "#FFFF00";

  return (
    <div
      className={`absolute inset-0 ease-out ${active ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}
      style={{ transitionDuration: `${TRANSITION_MS}ms` }}
      aria-hidden={!active}
    >
      <Image
        src={slide.image}
        alt=""
        fill
        priority={active}
        sizes="(max-width: 1400px) 100vw, 1400px"
        className="object-cover"
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(14,14,18,0.92) 0%, rgba(14,14,18,0.7) 30%, rgba(14,14,18,0) 60%)",
        }}
      />

      <div className="relative z-10 flex h-full items-center px-6 md:px-10 lg:px-14">
        <div className="max-w-md">
          {slide.accent ? (
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: accentColor }}>
              {slide.accent}
            </div>
          ) : null}

          <h2 className="mb-2 text-3xl font-black leading-[1.05] tracking-tight text-white md:text-4xl lg:text-5xl">
            {slide.headline}
          </h2>

          {slide.subline ? <p className="mb-5 text-sm leading-snug text-white/70 md:text-base">{slide.subline}</p> : null}

          {slide.external ? (
            <a
              href={slide.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#FFFF00] px-5 py-2.5 text-sm font-bold text-black transition-all hover:brightness-110"
            >
              {slide.cta}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </a>
          ) : (
            <Link
              href={slide.href}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#FFFF00] px-5 py-2.5 text-sm font-bold text-black transition-all hover:brightness-110"
            >
              {slide.cta}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PromoCarousel() {
  const slides = PROMO_SLIDES;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback(
    (i: number) => {
      setIndex(((i % slides.length) + slides.length) % slides.length);
    },
    [slides.length]
  );

  const next = useCallback(() => {
    goTo(index + 1);
  }, [index, goTo]);

  const prev = useCallback(() => {
    goTo(index - 1);
  }, [index, goTo]);

  useEffect(() => {
    if (paused || slides.length <= 1) return undefined;
    timerRef.current = setTimeout(next, DWELL_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [index, paused, next, slides.length]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") prev();
      if (event.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next]);

  const onTouchStart = (event: TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const onTouchEnd = (event: TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) {
      if (delta < 0) next();
      else prev();
    }
    touchStartX.current = null;
  };

  if (slides.length === 0) return null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-[#16161C]"
      style={{ aspectRatio: "4 / 1" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      role="region"
      aria-roledescription="carousel"
      aria-label="Promotional highlights"
    >
      {slides.map((slide, i) => (
        <Slide key={slide.id} slide={slide} active={i === index} />
      ))}

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 z-30 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/80 backdrop-blur-md transition-all hover:bg-black/70 hover:text-white md:flex"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button
            type="button"
            onClick={next}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 z-30 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/80 backdrop-blur-md transition-all hover:bg-black/70 hover:text-white md:flex"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      ) : null}

      {slides.length > 1 ? (
        <div className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 gap-1.5">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? "w-6 bg-[#FFFF00]" : "w-1.5 bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
