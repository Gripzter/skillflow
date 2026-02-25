export type MemoryMatchPlayer = 1 | 2;

export type MemoryCardState = "hidden" | "revealed" | "matched";

export interface MemoryCard {
  /** Stable id for this card instance (0..N-1) */
  id: number;
  /** Emoji/icon displayed when face-up */
  icon: string;
  /** Current visual/logical state */
  state: MemoryCardState;
  /** 0 when unclaimed, 1 or 2 when matched by player */
  matchedBy: 0 | MemoryMatchPlayer;
}

export interface MemoryMatchConfig {
  pairs: number;
}

// Default 6x6 grid => 18 pairs
export const DEFAULT_MEMORY_MATCH_CONFIG: MemoryMatchConfig = {
  pairs: 18,
};

export const MEMORY_ICONS = [
  "🎮",
  "🎯",
  "🏆",
  "🎲",
  "⚡",
  "🔥",
  "💎",
  "🎵",
  "🚀",
  "🌟",
  "🎪",
  "🎭",
  "🎨",
  "🎬",
  "🎸",
  "🏈",
  "🎱",
  "👑",
] as const;

/**
 * Create a shuffled deck of cards.
 * Each icon appears exactly twice.
 */
export function createShuffledDeck(config: MemoryMatchConfig = DEFAULT_MEMORY_MATCH_CONFIG): MemoryCard[] {
  const { pairs } = config;
  if (pairs > MEMORY_ICONS.length) {
    throw new Error(`Requested ${pairs} pairs but only ${MEMORY_ICONS.length} icons available`);
  }
  const icons = MEMORY_ICONS.slice(0, pairs);
  const cards: MemoryCard[] = [];
  let id = 0;
  for (const icon of icons) {
    cards.push(
      { id: id++, icon, state: "hidden", matchedBy: 0 },
      { id: id++, icon, state: "hidden", matchedBy: 0 }
    );
  }
  return shuffle(cards);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function allPairsFound(cards: MemoryCard[]): boolean {
  return cards.every((c) => c.state === "matched");
}

export function remainingPairs(cards: MemoryCard[]): number {
  const matched = cards.filter((c) => c.state === "matched").length / 2;
  const totalPairs = cards.length / 2;
  return Math.max(0, totalPairs - matched);
}

export function canFlipCard(cards: MemoryCard[], index: number): boolean {
  const card = cards[index];
  if (!card) return false;
  return card.state === "hidden";
}

export function flipCard(cards: MemoryCard[], index: number): MemoryCard[] {
  if (!canFlipCard(cards, index)) return cards;
  const next = cards.slice();
  next[index] = { ...next[index], state: "revealed" };
  return next;
}

export function hideCards(cards: MemoryCard[], indices: number[]): MemoryCard[] {
  const set = new Set(indices);
  return cards.map((c, i) =>
    set.has(i) && c.state === "revealed"
      ? { ...c, state: "hidden" }
      : c
  );
}

export function markMatched(
  cards: MemoryCard[],
  indices: [number, number],
  player: MemoryMatchPlayer
): MemoryCard[] {
  const set = new Set(indices);
  return cards.map((c, i) =>
    set.has(i)
      ? {
          ...c,
          state: "matched",
          matchedBy: player,
        }
      : c
  );
}

