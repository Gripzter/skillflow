/**
 * Promo carousel slide configuration.
 *
 * IMAGE SPEC:
 * - Dimensions: 2400 × 600 pixels (4:1 aspect ratio)
 * - Safe text zone: leftmost 800px (don't put critical visuals past 1/3 from left)
 * - Format: PNG for hard-edge graphics, JPG @ 90% for photographic content
 * - Target weight: under 400KB per slide
 * - Color profile: sRGB
 * - Filename: lowercase-with-dashes.jpg, drop into /public/images/promo/
 */

export type PromoSlide = {
  id: string;
  image: string;
  accent?: string;
  accentColor?: string;
  headline: string;
  subline?: string;
  cta: string;
  href: string;
  external?: boolean;
};

export const PROMO_SLIDES: PromoSlide[] = [
  {
    id: "last-touch",
    image: "/images/events/last-touch.jpg",
    accent: "FEATURED EVENT",
    headline: "Last Touch",
    subline: "Hold your ground. Win the pot.",
    cta: "Join Now",
    href: "/events/last-touch",
  },
  {
    id: "founders",
    image: "/images/promo/founders.jpg",
    accent: "BETA EXCLUSIVE",
    headline: "Become a Founder",
    subline: "Reach Platinum before the beta window closes.",
    cta: "See Rewards",
    href: "/founders",
  },
  {
    id: "case-drop",
    image: "/images/promo/case-drop.jpg",
    accent: "NEW",
    headline: "Diamond Cases Live",
    subline: "Higher tier drops, legendary cosmetics.",
    cta: "Open a Case",
    href: "/cases",
  },
];
