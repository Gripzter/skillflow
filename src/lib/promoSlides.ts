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
    image: "/images/promo/last-touch.jpg",
    accent: "FEATURED EVENT",
    headline: "Last Touch",
    subline: "Hold your ground. Win the pot.",
    cta: "Join Now",
    href: "/last-touch",
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
