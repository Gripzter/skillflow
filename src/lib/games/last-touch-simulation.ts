/**
 * Last Touch — simulation engine for the massive multiplayer endurance game.
 * All players except the real user are bots. Eliminations, late entries, and
 * prize pool are simulated with realistic curves.
 */

export const ENTRY_FEE_TIERS_MINUTES = [0, 10, 20, 30, 40, 50, 60] as const;
export const ENTRY_FEE_AMOUNTS = [1, 2, 5, 10, 25, 50] as const; // $ at each tier; 60+ = closed
export const PLATFORM_FEE_PERCENT = 3;

export function getEntryFeeAtMinute(minutes: number): number | null {
  if (minutes >= 60) return null;
  for (let i = ENTRY_FEE_TIERS_MINUTES.length - 1; i >= 0; i--) {
    if (minutes >= ENTRY_FEE_TIERS_MINUTES[i]) return ENTRY_FEE_AMOUNTS[i];
  }
  return 1;
}

export function getNextTierMinutes(currentMinutes: number): { at: number; fee: number } | null {
  for (let i = 0; i < ENTRY_FEE_TIERS_MINUTES.length; i++) {
    if (ENTRY_FEE_TIERS_MINUTES[i] > currentMinutes)
      return { at: ENTRY_FEE_TIERS_MINUTES[i], fee: ENTRY_FEE_AMOUNTS[i] ?? 50 };
  }
  return null;
}

// 200+ gaming-style usernames for bots
const FAKE_USERNAMES = [
  "xKiller99", "ProGamer_Mike", "SnipeElite420", "NoScope360", "ChessMaster", "CasualPro",
  "HighRoller99", "DarkPhoenix", "ShadowBlade", "StormRider", "IceQueen", "FireDragon",
  "NeonNinja", "CyberPunk", "GhostRecon", "TitanSlayer", "RageQuit", "LuckyShot",
  "AceVentura", "BeastMode", "CryptoKing", "DiamondHands", "EpicGamer", "FrostByte",
  "GoldenGun", "HawkEye", "IronFist", "JadeTiger", "KillerBee", "LoneWolf",
  "MysticMage", "NightOwl", "OmegaForce", "PhantomX", "QuickDraw", "RavenClaw",
  "SilverFox", "ThunderBolt", "UltraViolet", "ViperStrike", "WildCard", "Xenon",
  "YellowJacket", "ZeroCool", "AlphaWolf", "BetaTester", "CosmicRay", "DeltaForce",
  "EchoSeven", "FusionCore", "GammaPulse", "HyperDrive", "Inferno", "JetStream",
  "KarmaKing", "LaserFocus", "MegaByte", "NovaStorm", "Outlaw", "PrimeTime",
  "QuantumLeap", "RazorEdge", "StarLord", "TurboCharge", "Umbra", "Vortex",
  "WarMachine", "XFactor", "YodaMaster", "Zephyr", "ApexPredator", "BlazeRunner",
  "CrimsonTide", "DragonSlayer", "Eclipse", "FatalStrike", "GrimReaper", "HellFire",
  "IronMan", "Joker", "Knockout", "Legend", "Maverick", "NinjaX", "Overlord",
  "PhoenixRise", "Quicksilver", "Rebel", "SteelFist", "Toxic", "Unstoppable",
  "Venom", "Warlord", "Xenon", "YinYang", "Zeus", "Artemis", "BladeRunner",
  "ChaosKing", "DeathWish", "EvilGenius", "FrostBite", "Gravity", "Hex",
  "Instinct", "Juggernaut", "Knight", "Liquid", "Midas", "Nebula", "Onyx",
  "Pandora", "Quasar", "Rogue", "Spartan", "Tempest", "Uprising", "Vanguard",
  "Warden", "Xero", "Yakuza", "Zenith", "Aurora", "BulletProof", "Cipher",
  "Dreadnought", "Enigma", "Fury", "Glitch", "Havoc", "Impulse", "Jade",
  "Kryptonite", "Lumin", "Mystic", "Nexus", "Oblivion", "Phenom", "Quantum",
  "Rampage", "Synergy", "Titan", "Umbra", "Viper", "Wraith", "Xenon",
  "Yuki", "Zodiac", "Ace", "Blitz", "Cobra", "Dynamo", "Echo", "Flux",
  "Grim", "Hades", "Icarus", "Jinx", "Kane", "Loki", "Morph", "Nova",
  "Odin", "Pulse", "Quake", "Raze", "Swift", "Tracer", "Unity", "Vex",
  "Wisp", "Xen", "Yolo", "Zed", "Alpha", "Bravo", "Chaos", "Delta",
  "Echo", "Foxtrot", "Gamma", "Halo", "Ion", "Jade", "Kilo", "Lima",
  "Mike", "Niner", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango",
  "Ultra", "Victor", "Whiskey", "Xray", "Yankee", "Zulu",
];

const REAL_PLAYER_ID = "__real__";

export interface LastTouchPlayer {
  id: string;
  username: string;
  entryTimeMs: number;
  entryFee: number;
  enduranceMs: number;
  eliminatedAtMs: number | null;
  eliminationReason: "time" | "lift" | "challenge" | "visibility" | null;
  isReal: boolean;
  warnings: number;
}

export interface LastTouchFeedEntry {
  id: string;
  type: "join" | "eliminate" | "late_join";
  username: string;
  message: string;
  atMs: number;
  amount?: number;
  rank?: number;
  prizePool?: number;
}

export interface LastTouchState {
  phase: "lobby" | "countdown" | "playing" | "final10" | "final3" | "final2" | "winner";
  gameStartMs: number | null;
  players: LastTouchPlayer[];
  prizePool: number;
  feed: LastTouchFeedEntry[];
  realPlayerEliminated: boolean;
  realPlayerRank: number | null;
  realPlayerHoldStartMs: number | null;
  realPlayerEliminatedAtMs: number | null;
  realPlayerWarnings: number;
  nextGameCountdownSec: number;
  lateEntryFee: number;
  milestonesReached: number[]; // e.g. [500, 1000]
}

function pickUsername(used: Set<string>): string {
  const pool = FAKE_USERNAMES.filter((u) => !used.has(u));
  return pool[Math.floor(Math.random() * pool.length)] || "Player" + Math.floor(Math.random() * 9999);
}

function genId(): string {
  return "lt-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
}

/** Endurance distribution: most 5–20 min, fewer 30–60, very few 60+. Returns ms. */
function randomEnduranceMs(): number {
  const r = Math.random();
  if (r < 0.5) return (5 + Math.random() * 15) * 60 * 1000;       // 5–20 min
  if (r < 0.85) return (20 + Math.random() * 40) * 60 * 1000;      // 20–60 min
  if (r < 0.97) return (60 + Math.random() * 60) * 60 * 1000;      // 60–120 min
  return (120 + Math.random() * 60) * 60 * 1000;                     // 120–180 min
}

/** Initial bot count between 300–800. */
export function createInitialBots(count: number): LastTouchPlayer[] {
  const used = new Set<string>();
  const players: LastTouchPlayer[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    const entryOffsetMs = Math.random() * 5 * 60 * 1000; // join over first 5 min
    players.push({
      id: genId(),
      username: pickUsername(used),
      entryTimeMs: now - entryOffsetMs,
      entryFee: 1,
      enduranceMs: randomEnduranceMs(),
      eliminatedAtMs: null,
      eliminationReason: null,
      isReal: false,
      warnings: 0,
    });
    used.add(players[players.length - 1].username);
  }
  return players;
}

/** Add the real player to the list. */
export function addRealPlayer(
  players: LastTouchPlayer[],
  username: string,
  entryFee: number
): LastTouchPlayer[] {
  const used = new Set(players.map((p) => p.username));
  const name = used.has(username) ? username + "_" + Math.floor(Math.random() * 100) : username;
  const real: LastTouchPlayer = {
    id: REAL_PLAYER_ID,
    username: name,
    entryTimeMs: Date.now(),
    entryFee,
    enduranceMs: Number.MAX_SAFE_INTEGER,
    eliminatedAtMs: null,
    eliminationReason: null,
    isReal: true,
    warnings: 0,
  };
  return [...players, real];
}

export function createInitialState(options: {
  initialBotsCount: number;
  nextGameInSec: number;
}): LastTouchState {
  const bots = createInitialBots(options.initialBotsCount);
  const prizePool = bots.length * 1; // $1 each
  const feed: LastTouchFeedEntry[] = bots.slice(-20).reverse().map((p, i) => ({
    id: genId(),
    type: "join",
    username: p.username,
    message: `${p.username} just joined! ($1.00)`,
    atMs: Date.now() - (20 - i) * 2000,
    amount: 1,
  }));
  return {
    phase: "lobby",
    gameStartMs: null,
    players: bots,
    prizePool,
    feed,
    realPlayerEliminated: false,
    realPlayerRank: null,
    realPlayerHoldStartMs: null,
    realPlayerEliminatedAtMs: null,
    realPlayerWarnings: 0,
    nextGameCountdownSec: options.nextGameInSec,
    lateEntryFee: 1,
    milestonesReached: [],
  };
}

/** Elimination rate curve: eliminations per minute by game minute. */
function eliminationsPerMinute(gameMinute: number): number {
  if (gameMinute < 5) return 1 + Math.random() * 2;
  if (gameMinute < 15) return 5 + Math.random() * 5;
  if (gameMinute < 30) return 10 + Math.random() * 10;
  if (gameMinute < 60) return 3 + Math.random() * 2;
  return 0.2 + Math.random() * 0.5;
}

/** Run one simulation tick: eliminate some bots, maybe add late entries, update feed. */
export function tickSimulation(
  state: LastTouchState,
  nowMs: number,
  realPlayerHolding: boolean
): LastTouchState {
  if (state.phase !== "playing" && state.phase !== "final10" && state.phase !== "final2" && state.phase !== "final3") {
    return state;
  }
  const gameElapsedMs = state.gameStartMs == null ? 0 : nowMs - state.gameStartMs;
  const gameElapsedMin = gameElapsedMs / (60 * 1000);
  const stillIn = state.players.filter((p) => p.eliminatedAtMs == null);
  const activeBots = stillIn.filter((p) => !p.isReal);
  let newPlayers = [...state.players];
  let newFeed = [...state.feed];
  let newPrizePool = state.prizePool;
  const newMilestones = [...state.milestonesReached];

  // Eliminate bots by endurance
  const rate = eliminationsPerMinute(gameElapsedMin);
  const toEliminate = Math.min(activeBots.length, Math.max(0, Math.floor(rate * (1 + Math.random()))));
  const byEndurance = [...activeBots].sort((a, b) => {
    const aEnd = a.entryTimeMs + a.enduranceMs;
    const bEnd = b.entryTimeMs + b.enduranceMs;
    return aEnd - bEnd;
  });
  for (let i = 0; i < toEliminate && i < byEndurance.length; i++) {
    const p = byEndurance[i];
    const idx = newPlayers.findIndex((x) => x.id === p.id);
    if (idx === -1) continue;
    const eliminatedAt = nowMs;
    const rank = state.players.filter((q) => q.eliminatedAtMs != null).length + 1;
    newPlayers[idx] = {
      ...newPlayers[idx],
      eliminatedAtMs: eliminatedAt,
      eliminationReason: "time",
    };
    newFeed.unshift({
      id: genId(),
      type: "eliminate",
      username: p.username,
      message: `${p.username} eliminated at ${formatHoldTime(eliminatedAt - state.gameStartMs!)} (Rank #${rank})`,
      atMs: eliminatedAt,
      rank,
    });
  }

  // Late entries (first 60 min only)
  if (gameElapsedMin < 60) {
    const joinChance = gameElapsedMin < 10 ? 0.08 : gameElapsedMin < 30 ? 0.03 : 0.01;
    if (Math.random() < joinChance) {
      const fee = getEntryFeeAtMinute(gameElapsedMin);
      if (fee != null) {
        const used = new Set(newPlayers.map((p) => p.username));
        const late: LastTouchPlayer = {
          id: genId(),
          username: pickUsername(used),
          entryTimeMs: nowMs,
          entryFee: fee,
          enduranceMs: randomEnduranceMs(),
          eliminatedAtMs: null,
          eliminationReason: null,
          isReal: false,
          warnings: 0,
        };
        newPlayers = [...newPlayers, late];
        newPrizePool += fee;
        newFeed.unshift({
          id: genId(),
          type: "late_join",
          username: late.username,
          message: `${late.username} joined for $${fee.toFixed(2)}! Prize pool now $${newPrizePool.toFixed(0)}!`,
          atMs: nowMs,
          amount: fee,
          prizePool: newPrizePool,
        });
      }
    }
  }

  // Milestones
  const milestones = [500, 1000, 5000, 10000];
  for (const m of milestones) {
    if (newPrizePool >= m && !newMilestones.includes(m)) {
      newMilestones.push(m);
    }
  }

  const remaining = newPlayers.filter((p) => p.eliminatedAtMs == null);
  let phase = state.phase;
  if (remaining.length <= 1) {
    phase = "winner";
  } else if (remaining.length <= 2 && phase !== "winner") {
    phase = "final2";
  } else if (remaining.length <= 3) {
    phase = "final3";
  } else if (remaining.length <= 10) {
    phase = "final10";
  }

  return {
    ...state,
    players: newPlayers,
    feed: newFeed.slice(0, 50),
    prizePool: newPrizePool,
    milestonesReached: newMilestones,
    phase,
  };
}

export function formatHoldTime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${h}:${min.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function eliminateRealPlayer(
  state: LastTouchState,
  reason: "lift" | "challenge" | "visibility",
  atMs: number
): LastTouchState {
  const idx = state.players.findIndex((p) => p.isReal);
  if (idx === -1) return state;
  const rank = state.players.filter((p) => p.eliminatedAtMs != null).length + 1;
  const newPlayers = [...state.players];
  newPlayers[idx] = {
    ...newPlayers[idx],
    eliminatedAtMs: atMs,
    eliminationReason: reason,
  };
  const reasonText =
    reason === "lift" ? "lifted" : reason === "visibility" ? "left the app" : "timed out on challenge";
  const newFeed = [
    {
      id: genId(),
      type: "eliminate" as const,
      username: state.players[idx].username,
      message: `${state.players[idx].username} ${reasonText} (Rank #${rank})`,
      atMs,
      rank,
    },
    ...state.feed,
  ];
  return {
    ...state,
    players: newPlayers,
    feed: newFeed.slice(0, 50),
    realPlayerEliminated: true,
    realPlayerRank: rank,
    realPlayerEliminatedAtMs: atMs,
  };
}

export function setRealPlayerHolding(state: LastTouchState, holdStartMs: number): LastTouchState {
  return {
    ...state,
    realPlayerHoldStartMs: holdStartMs,
  };
}

export function addRealPlayerWarning(state: LastTouchState): LastTouchState {
  const idx = state.players.findIndex((p) => p.isReal);
  if (idx === -1) return state;
  const p = state.players[idx];
  const warnings = (p.warnings ?? 0) + 1;
  const newPlayers = [...state.players];
  newPlayers[idx] = { ...newPlayers[idx], warnings };
  return {
    ...state,
    players: newPlayers,
    realPlayerWarnings: warnings,
  };
}

/** Net prize after platform fee. */
export function netPrizePool(gross: number): number {
  return gross * (1 - PLATFORM_FEE_PERCENT / 100);
}
