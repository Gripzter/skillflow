"use client";

import Link from "next/link";
import Image from "next/image";
import AppNavbar from "@/components/AppNavbar";

const ACTIVE_EVENTS = [
  {
    id: "last-touch",
    name: "Last Touch",
    tagline: "Hold your ground. Win the pot.",
    description:
      "A scheduled global battle royale. Hold the button. Last finger standing takes the pool.",
    image: "/images/events/last-touch.jpg",
    prizePool: 1247,
    nextRunUtc: "14:00",
    status: "live",
    href: "/events/last-touch",
    accent: "FEATURED EVENT",
  },
];

const UPCOMING_EVENTS: typeof ACTIVE_EVENTS = [];

export default function EventsContent() {
  return (
    <div className="min-h-screen bg-[#0E0E12] px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <AppNavbar currentPage="events" />
      <div className="max-w-6xl mx-auto mt-4 sm:mt-6">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-1 sm:mb-2">
          Events
        </h1>
        <p className="text-sm sm:text-base text-white/60 mb-8 sm:mb-10">
          Live events, tournaments, and limited-time challenges.
        </p>

        <section className="mb-12">
          <h2 className="text-[11px] uppercase tracking-[0.15em] text-white/50 font-semibold mb-4">
            Live now
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {ACTIVE_EVENTS.map((event) => (
              <Link
                key={event.id}
                href={event.href}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#16161C] hover:border-[#FFFF00]/40 transition-all"
              >
                <div className="relative aspect-[16/10] sm:aspect-[3/2]">
                  <Image
                    src={event.image}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(14,14,18,0.1) 0%, rgba(14,14,18,0.95) 100%)",
                    }}
                  />

                  <div className="absolute top-3 left-3 px-2 py-1 bg-[#FFFF00] text-black text-[10px] sm:text-[11px] font-bold uppercase tracking-wide rounded">
                    Live
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
                    <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.15em] text-[#FFFF00] font-semibold mb-1">
                      {event.accent}
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-white mb-2 leading-tight">
                      {event.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-white/70 mb-4 leading-snug">{event.tagline}</p>

                    <div className="flex items-center gap-4 sm:gap-6">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-white/50">Prize pool</div>
                        <div className="text-lg sm:text-xl font-bold text-white">
                          {event.prizePool.toLocaleString()} <span className="text-[#FFFF00]">$</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-white/50">
                          Next round (UTC)
                        </div>
                        <div className="text-lg sm:text-xl font-bold text-white">{event.nextRunUtc}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {UPCOMING_EVENTS.length > 0 ? (
          <section>
            <h2 className="text-[11px] uppercase tracking-[0.15em] text-white/50 font-semibold mb-4">
              Coming soon
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" />
          </section>
        ) : (
          <section>
            <h2 className="text-[11px] uppercase tracking-[0.15em] text-white/50 font-semibold mb-4">
              Coming soon
            </h2>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 sm:p-12 text-center">
              <p className="text-white/50 text-sm">
                More events on the way. Follow @skillflowgg for announcements.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
