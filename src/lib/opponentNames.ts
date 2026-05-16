/**
 * Realistic random opponent names for matchmaking display.
 * Used when a bot is the actual opponent.
 */

const NAMES = [
  "Raze", "Nori", "Kael", "Vex", "Echo", "Cipher", "Onyx", "Pyre",
  "Hex", "Volt", "Frost", "Slate", "Rune", "Blitz", "Sable", "Tahl",
  "Mira", "Zyra", "Kira", "Lyra", "Nyx", "Vesper", "Iris", "Juno",
  "Ashen", "Tempest", "Strix", "Cinder", "Halo", "Mako", "Drax", "Rho",
  "Kano", "Vega", "Sol", "Lux", "Orin", "Bryn", "Nova", "Pax",
  "Quint", "Saga", "Tav", "Ursa", "Vox", "Wren", "Yara", "Zane",
  "Astra", "Bo", "Cael", "Dax", "Eli", "Fenn", "Garn", "Holt",
  "Idris", "Jax", "Kade", "Lior", "Maeve", "Noor", "Oso", "Pell",
  "Quincy", "Riven", "Sloan", "Thane", "Uma", "Vance", "Wynn", "Xael",
  "Yarrow", "Zev",
];

const SUFFIXES = ["", "", "", "", "x", "9", "7", "_", "kx", "01", "z"];

export function pickOpponentName(seed?: string): string {
  const seedNum = seed
    ? [...seed].reduce((acc, c) => acc + c.charCodeAt(0), 0)
    : Math.floor(Math.random() * 100000);

  const name = NAMES[seedNum % NAMES.length];
  const suffix = SUFFIXES[(seedNum * 7) % SUFFIXES.length];
  return name + suffix;
}
