export const SEEDED_USERNAMES = [
  "shadowfox", "nova_xx", "phoenix77", "vortex_99", "rogue_z", "silent_k", "drift99", "maverick_07",
  "omega_run", "ionblade", "lunar_op", "quickmint", "nebula", "echo_99", "cipher_x", "frost_07",
  "volt_z", "chrome_k", "apex_77", "reaper_22", "hex_blade", "glitch", "nomad_x", "pulse_99",
  "ravenclaw", "snowfall", "darkrise", "flashpoint", "midas_07", "syncwave", "titan_x", "wraith_99",
  "zenith", "blackwolf", "crimson_k", "duskfall", "embers", "frostbite", "gravewalk", "haze_77",
  "alex_p", "kira_06", "sam_44", "mia_x", "leo_22", "jay_99", "eli_07", "nina_x",
  "ben_44", "lia_99", "max_07", "zoe_x", "ari_22", "kai_99", "rio_07", "sky_44",
  "remy_x", "lex_22", "dani_99", "milo_07", "noa_x", "iris_22", "theo_44", "ezra_99",
  "latemove", "firststrike", "endgame", "kingside", "bluefall", "quietstorm", "sharpcorner", "hardpivot",
  "flatline", "mindgap", "overclock", "silentrise", "fastwrist", "longgame", "cleancut", "sharpedge",
  "lastnerve", "finalkey", "softlock", "roundzero", "firstchair", "hotline", "bluelane", "redwave",
  "tomas_lt", "ruta_99", "kaspar", "dovydas", "austejaa", "lukas_07", "jonas_44", "simas_x",
  "mantas_77", "rokas99", "gabrius", "eimantas", "vaida_22", "monika_x", "ieva_07", "rasa_44",
  "dainius", "arnas_99", "titas_x", "lauryna",
  "M7", "KX_", "_volt", "42x", "Z7", "V9", "X_K", "Q_07", "N_3", "B_44",
  "C_22", "F_77", "L_99", "R_x", "T_07", "W_44", "Y_99", "A_x", "D_07", "G_22",
  "fizzy_x", "crash_99", "ember_07", "radio_22", "static_x", "vapor_77", "shutter", "orbit_99",
  "satchel", "tundra", "pixelpush", "lowkey_07", "highground", "midcap", "longshot", "thinice",
  "mainevent", "sidequest", "fullcourt", "rapidfire", "softban", "toplane", "jungler", "support_x",
  "anchor_07", "binary", "comet_99", "dynamo_x", "erratic", "flicker", "goliath", "hover_07",
  "inkblot", "jetstream", "kilowatt", "lullaby", "magnet_x", "noctis", "opaque", "perish",
  "quartz_07", "redshift", "syntax", "tangent", "umbra_x", "velour", "waxwing", "xerox_99",
  "yonder", "zealot", "amber_07", "baxter", "cypher", "dilate", "errant", "falcon_x",
  "glaze_99", "hertz_07", "imprint", "jovial", "keystone", "lattice", "magma_x", "naptime",
];

export const VALID_SP_AMOUNTS = [50, 100, 200, 500, 1000, 2000];

const SP_WEIGHTS = [
  { amount: 50, weight: 30 },
  { amount: 100, weight: 35 },
  { amount: 200, weight: 20 },
  { amount: 500, weight: 10 },
  { amount: 1000, weight: 4 },
  { amount: 2000, weight: 1 },
];

export function pickWeightedSpAmount(): number {
  const totalWeight = SP_WEIGHTS.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const w of SP_WEIGHTS) {
    if (roll < w.weight) return w.amount;
    roll -= w.weight;
  }
  return 100;
}

export const TICKER_GAMES = [
  "Chess", "Connect 4", "Reaction Duel", "Spelling Bee",
  "Memory Match", "Checkers", "Trivia", "Typing Race",
];

export function pickRandomGame(): string {
  return TICKER_GAMES[Math.floor(Math.random() * TICKER_GAMES.length)];
}

export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generateSeededTickerBatch(count = 20): { username: string; game: string; amount: number }[] {
  const shuffled = shuffleArray(SEEDED_USERNAMES);
  return shuffled.slice(0, count).map((username) => ({
    username,
    game: pickRandomGame(),
    amount: pickWeightedSpAmount(),
  }));
}
