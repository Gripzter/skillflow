const adjectives = [
  "swift",
  "night",
  "iron",
  "quiet",
  "rookie",
  "turbo",
  "silver",
  "wild",
  "sharp",
  "ghost",
  "crimson",
  "lucky",
  "rapid",
  "steady",
  "final",
  "midnight",
  "electric",
  "grit",
  "solar",
  "velvet",
];

const nouns = [
  "falcon",
  "rider",
  "wolf",
  "storm",
  "driver",
  "racer",
  "comet",
  "viper",
  "titan",
  "ace",
  "pilot",
  "charger",
  "phantom",
  "engine",
  "maverick",
  "sparrow",
  "striker",
  "blazer",
  "outlaw",
  "lap",
];

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function pick(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

export function generateAnonymousName(): string {
  return `${titleCase(pick(adjectives))} ${titleCase(pick(nouns))}`;
}
