"use client";

import { useEffect, useRef, useState } from "react";

// TODO: Replace with real live stats from Supabase when we launch
const STATS = [
  { value: 10000, suffix: "+", label: "Games Played" },
  { value: 50000, prefix: "$", suffix: "+", label: "Won by Players" },
  { value: 500, suffix: "+", label: "Active Players" },
];

function useCountUp(end: number, prefix = "", suffix = "", duration = 2000, trigger: boolean) {
  const [count, setCount] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!trigger) return;
    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - (1 - progress) ** 2;
      setCount(Math.floor(easeOut * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end, duration, trigger]);

  return `${prefix}${count.toLocaleString()}${suffix}`;
}

function StatItem({
  value,
  prefix = "",
  suffix = "",
  label,
  visible,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  label: string;
  visible: boolean;
}) {
  const display = useCountUp(value, prefix, suffix, 1800, visible);
  return (
    <div className="text-center">
      <p className="text-3xl font-bold text-teal sm:text-4xl md:text-5xl" style={{ textShadow: "0 0 24px rgba(0,229,199,0.3)" }}>
        {display}
      </p>
      <p className="mt-1 text-sm text-body-gray">{label}</p>
    </div>
  );
}

export default function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="border-t border-white/5 bg-[#0A0E17] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col items-center justify-between gap-10 sm:flex-row sm:gap-8">
          {STATS.map((stat) => (
            <StatItem
              key={stat.label}
              value={stat.value}
              prefix={stat.prefix ?? ""}
              suffix={stat.suffix ?? ""}
              label={stat.label}
              visible={visible}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
