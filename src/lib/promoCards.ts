export type PromoCard = {
  id: string;
  image: string;
  alt: string;
  type: "winner" | "founders" | "tournament" | "rank" | "drop" | "streak";
};

/**
 * Promo cards rotate in the hero panel.
 * To update content: replace the image file in /public/images/promo/ with a new version,
 * or add new entries here.
 *
 * Image specs: 16:9 aspect ratio, recommended export at 1920x1080 PNG or JPG, optimized for web.
 *
 * Card types and their intent:
 * - winner: spotlight a big SK win
 * - founders: drive Founders Program signups
 * - tournament: hype an upcoming tournament
 * - rank: showcase someone reaching a high rank
 * - drop: announce a new game or event
 * - streak: show a player on a hot streak
 */
export const PROMO_CARDS: PromoCard[] = [
  {
    id: "winner-1",
    image: "/images/promo/winner-spotlight.png",
    alt: "Player won big in Chess",
    type: "winner",
  },
  {
    id: "founders-1",
    image: "/images/promo/founders-spots.png",
    alt: "Founder spots remaining",
    type: "founders",
  },
  {
    id: "tournament-1",
    image: "/images/promo/tournament-hype.png",
    alt: "Saturday tournament prize pool",
    type: "tournament",
  },
  {
    id: "rank-1",
    image: "/images/promo/rank-diamond.png",
    alt: "Player climbed the leaderboard",
    type: "rank",
  },
  {
    id: "drop-1",
    image: "/images/promo/new-game-drop.png",
    alt: "New game launched",
    type: "drop",
  },
  {
    id: "streak-1",
    image: "/images/promo/win-streak.png",
    alt: "Player on a winning streak",
    type: "streak",
  },
];
