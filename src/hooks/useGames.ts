"use client";

export type GameCategory = "strategy" | "reflex" | "knowledge";

export type PlayGameCard = {
  name: string;
  slug: string;
  image: string;
  category: GameCategory;
  waitSeconds: number;
};

const GAMES: PlayGameCard[] = [
  { name: "Chess", slug: "chess", image: "/images/chess-card.png", category: "strategy", waitSeconds: 12 },
  { name: "Connect 4", slug: "connect-4", image: "/images/connect4-card.png", category: "strategy", waitSeconds: 14 },
  { name: "Checkers", slug: "checkers", image: "/images/checkers-card.png", category: "strategy", waitSeconds: 16 },
  { name: "Reaction Duel", slug: "reaction-duel", image: "/images/reaction-duel-card.png", category: "reflex", waitSeconds: 9 },
  { name: "Memory Match", slug: "memory-match", image: "/images/memory-match-card.png", category: "reflex", waitSeconds: 11 },
  { name: "Typing Race", slug: "typing-race", image: "/images/typing-race-card.png", category: "reflex", waitSeconds: 13 },
  { name: "Spelling Bee", slug: "spelling-bee", image: "/images/spelling-bee-card.png", category: "knowledge", waitSeconds: 12 },
  { name: "Trivia", slug: "trivia", image: "/images/trivia-card.png", category: "knowledge", waitSeconds: 15 },
];

export function useGames() {
  return { games: GAMES };
}
