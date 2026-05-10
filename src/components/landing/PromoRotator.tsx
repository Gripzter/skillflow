"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PROMO_CARDS, type PromoCard } from "@/lib/promoCards";

const DWELL_MS = 5000;
const TRANSITION_MS = 600;

export default function PromoRotator() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = setTimeout(() => {
        transitionTimeoutRef.current = null;
        setCurrentIndex((prev) => (prev + 1) % PROMO_CARDS.length);
        setIsTransitioning(false);
      }, TRANSITION_MS);
    }, DWELL_MS);

    return () => {
      clearInterval(interval);
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    };
  }, []);

  const currentCard = PROMO_CARDS[currentIndex];
  const nextIndex = (currentIndex + 1) % PROMO_CARDS.length;
  const nextCard = PROMO_CARDS[nextIndex];

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        borderRadius: "12px",
        overflow: "hidden",
        background: "#13131a",
        border: "1px solid #1a1a22",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: isTransitioning ? "translateX(-100%)" : "translateX(0)",
          transition: `transform ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        }}
      >
        <PromoCardView card={currentCard} priority />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: isTransitioning ? "translateX(0)" : "translateX(100%)",
          transition: `transform ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        }}
      >
        <PromoCardView card={nextCard} />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 6,
          zIndex: 2,
        }}
      >
        {PROMO_CARDS.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === currentIndex ? 24 : 6,
              height: 6,
              borderRadius: 3,
              background: i === currentIndex ? "#FF5E00" : "rgba(255, 255, 255, 0.25)",
              transition: "all 400ms ease-out",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PromoCardView({ card, priority = false }: { card: PromoCard; priority?: boolean }) {
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    setErrored(false);
  }, [card.id, card.image]);

  if (errored) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#13131a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#666",
          fontSize: 12,
          textAlign: "center",
          padding: 20,
        }}
      >
        {card.alt}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Image
        src={card.image}
        alt={card.alt}
        fill
        priority={priority}
        sizes="(max-width: 768px) 100vw, 520px"
        style={{ objectFit: "cover", objectPosition: "center" }}
        onError={() => setErrored(true)}
      />
    </div>
  );
}
