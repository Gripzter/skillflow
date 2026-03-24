import type { BotDifficulty } from "./bot-engine";

export interface TriviaCategory {
  id: number;
  name: string;
  icon: string;
}

export const TRIVIA_CATEGORIES: TriviaCategory[] = [
  { id: 9, name: "General Knowledge", icon: "🌍" },
  { id: 21, name: "Sports", icon: "⚽" },
  { id: 17, name: "Science", icon: "🔬" },
  { id: 23, name: "History", icon: "📜" },
  { id: 11, name: "Movies & TV", icon: "🎬" },
  { id: 12, name: "Music", icon: "🎵" },
  { id: 22, name: "Geography", icon: "🗺️" },
  { id: 15, name: "Gaming", icon: "🎮" },
  { id: 18, name: "Technology", icon: "💻" },
  { id: 9, name: "Food & Drink", icon: "🍕" },
];

export interface TriviaQuestion {
  question: string;
  category: string;
  difficulty: string;
  correct_answer: string;
  incorrect_answers: string[];
  shuffledAnswers: string[];
  correctIndex: number;
}

export function decodeHtml(html: string): string {
  if (typeof document === "undefined") return html;
  const el = document.createElement("textarea");
  el.innerHTML = html;
  return el.value;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function fetchTriviaQuestions(
  categoryId: number,
  amount = 10
): Promise<TriviaQuestion[]> {
  const url = `https://opentdb.com/api.php?amount=${amount}&category=${categoryId}&type=multiple`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch trivia questions");
  const data = (await res.json()) as {
    response_code: number;
    results: {
      question: string;
      correct_answer: string;
      incorrect_answers: string[];
      category: string;
      difficulty: string;
    }[];
  };
  if (data.response_code !== 0)
    throw new Error("Not enough questions for this category");

  return data.results.map((q) => {
    const correct_answer = decodeHtml(q.correct_answer);
    const incorrect_answers = q.incorrect_answers.map(decodeHtml);
    const question = decodeHtml(q.question);
    const shuffledAnswers = shuffle([correct_answer, ...incorrect_answers]);
    const correctIndex = shuffledAnswers.indexOf(correct_answer);
    return {
      question,
      category: decodeHtml(q.category),
      difficulty: q.difficulty,
      correct_answer,
      incorrect_answers,
      shuffledAnswers,
      correctIndex,
    };
  });
}

export const QUESTION_TIME_MS = 15000;

export function calculatePoints(timeRemainingMs: number): number {
  const base = 10;
  const speedBonus = Math.round(5 * Math.max(0, timeRemainingMs / QUESTION_TIME_MS));
  return base + Math.min(5, speedBonus);
}

export interface TriviaBot {
  correct: boolean;
  delayMs: number;
}

export function getTriviaBot(difficulty: BotDifficulty): TriviaBot {
  const accuracy = { rookie: 0.4, gamer: 0.65, professional: 0.85 }[difficulty];
  const correct = Math.random() < accuracy;
  let delayMs: number;
  if (difficulty === "rookie") {
    delayMs = 8000 + Math.floor(Math.random() * 7001); // 8–15s
  } else if (difficulty === "gamer") {
    delayMs = 4000 + Math.floor(Math.random() * 4001); // 4–8s
  } else {
    delayMs = 1000 + Math.floor(Math.random() * 3001); // 1–4s
  }
  return { correct, delayMs };
}
