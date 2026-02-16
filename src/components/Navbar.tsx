"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const navLinks = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Games", href: "#games" },
  { label: "Arena", href: "/external" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "FAQ", href: "#faq" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-charcoal/95 backdrop-blur-md card-border border-x-0 border-t-0" : ""
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <a
          href="#"
          className="text-xl font-bold tracking-tight sm:text-2xl"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <span className="text-white">Skill</span>
          <span className="text-teal">Flow</span>
        </a>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) =>
            link.href.startsWith("#") ? (
              <a
                key={link.href}
                href={link.href}
                className="text-body-gray transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="text-body-gray transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            )
          )}
          <Link
            href="/login"
            className="text-body-gray transition-colors hover:text-white"
          >
            Log In
          </Link>
          <a
            href="#hero"
            className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-charcoal transition-all hover:shadow-teal-glow"
          >
            Join Waitlist
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="flex flex-col gap-1.5 p-2 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <span
            className={`h-0.5 w-6 bg-white transition-all ${
              mobileOpen ? "translate-y-2 rotate-45" : ""
            }`}
          />
          <span
            className={`h-0.5 w-6 bg-white transition-all ${
              mobileOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`h-0.5 w-6 bg-white transition-all ${
              mobileOpen ? "-translate-y-2 -rotate-45" : ""
            }`}
          />
        </button>
      </nav>

      {/* Mobile menu */}
      <div
        className={`overflow-hidden transition-all duration-300 md:hidden ${
          mobileOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="flex flex-col gap-2 border-t border-white/5 bg-charcoal px-4 py-4">
          {navLinks.map((link) =>
            link.href.startsWith("#") ? (
              <a
                key={link.href}
                href={link.href}
                className="rounded-lg py-2.5 px-3 text-body-gray transition-colors hover:bg-card hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg py-2.5 px-3 text-body-gray transition-colors hover:bg-card hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            )
          )}
          <Link
            href="/login"
            className="rounded-lg py-2.5 px-3 text-body-gray transition-colors hover:bg-card hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            Log In
          </Link>
          <a
            href="#hero"
            className="mt-2 rounded-lg bg-teal py-2.5 px-3 text-center font-semibold text-charcoal"
            onClick={() => setMobileOpen(false)}
          >
            Join Waitlist
          </a>
        </div>
      </div>
    </header>
  );
}
