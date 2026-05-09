const BANNED_WORDS = [
  "test",
  "admin",
  "fuck",
  "shit",
  "nazi",
  "hitler",
  "bitch",
  "asshole",
  "cunt",
  "dick",
  "faggot",
  "nigger",
  "whore",
  "slut",
  "retard",
];

export function normalizeUsername(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function hasBannedWord(value: string): boolean {
  const lower = value.toLowerCase();
  return BANNED_WORDS.some((word) => lower.includes(word));
}

export function isNumericOnlyUsername(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export function isSanitizedUsername(value: string | null | undefined): boolean {
  const normalized = normalizeUsername(value);
  if (!normalized) return false;
  if (hasBannedWord(normalized)) return false;
  if (isNumericOnlyUsername(normalized)) return false;
  return true;
}
