"use client";

import { useEffect, useState } from "react";

const stats = [
  { value: 10000, suffix: "+", label: "Players" },
  { value: 500, suffix: "K+", label: "Won" },
  { value: 50000, suffix: "+", label: "Matches Played" },
];

function AnimatedCounter({
  value,
  suffix,
  duration = 2000,
}: {
  value: number;
  suffix: string;
  duration?: number;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const startTime = performance.now();

    const step = (timestamp: number) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * end));
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, [value, duration]);

  const formatted =
    value >= 10000
      ? count.toLocaleString()
      : value >= 1000
        ? (count / 1000).toFixed(count >= 10000 ? 0 : 1) + "K"
        : count.toString();

  return (
    <>
      {formatted}
      {suffix}
    </>
  );
}

export default function Stats() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { threshold: 0.3 }
    );
    const el = document.getElementById("stats-section");
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="leaderboard"
      className="border-y border-white/5 px-4 py-16 sm:px-6 lg:px-8"
    >
      <div id="stats-section" className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-10 text-center sm:grid-cols-3">
          {stats.map((stat, i) => (
            <div key={stat.label} className="relative">
              <div className="text-3xl font-bold text-white sm:text-4xl">
                {visible ? (
                  <>
                    {i === 1 ? (
                      <>${stat.value}{stat.suffix}</>
                    ) : (
                      <AnimatedCounter
                        value={stat.value}
                        suffix={stat.suffix}
                        duration={1800}
                      />
                    )}
                  </>
                ) : (
                  "0"
                )}
              </div>
              <p className="mt-1 text-body-gray">{stat.label}</p>
              <div className="absolute -bottom-4 left-1/2 h-0.5 w-12 -translate-x-1/2 bg-teal" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
