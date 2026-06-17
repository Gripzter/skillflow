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
  image?: string;
  accent?: string;
  accentColor?: string;
  headline: string;
  subline?: string;
  cta: string;
  href?: string;
  external?: boolean;
  /** Opens CreateQRMatch modal instead of navigating */
  action?: "open-qr-match";
  /** Dark gradient background when no image */
  gradient?: string;
};

export const PROMO_SLIDES: PromoSlide[] = [
  {
    id: "play-in-person",
    gradient: "linear-gradient(135deg, #0E0E12 0%, #1a1a24 40%, #2a2a10 100%)",
    accent: "FACE TO FACE",
    headline: "Play In Person",
    subline: "Challenge anyone, anywhere. Scan to play.",
    cta: "Generate Code",
    action: "open-qr-match",
  },
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
    subline: "Compete early. Help shape the arena.",
    cta: "See Rewards",
    href: "/founders",
  },
];
