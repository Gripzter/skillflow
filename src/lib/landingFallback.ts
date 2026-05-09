export const seededTickerEvents = [
  { username: "shadowfox", game: "Reaction Duel", amount: 100 },
  { username: "kira_06", game: "Chess", amount: 200 },
  { username: "nova_xx", game: "Memory Match", amount: 100 },
  { username: "drift99", game: "Connect 4", amount: 50 },
  { username: "alex_p", game: "Spelling Bee", amount: 100 },
  { username: "silent_k", game: "Checkers", amount: 200 },
  { username: "phoenix77", game: "Chess", amount: 500 },
  { username: "maverick", game: "Reaction Duel", amount: 100 },
  { username: "echo_99", game: "Typing Race", amount: 100 },
  { username: "vortex", game: "Trivia", amount: 200 },
  { username: "lunar_op", game: "Chess", amount: 100 },
  { username: "rogue_z", game: "Memory Match", amount: 50 },
];

export const fallbackFeaturedMatches = [
  {
    player1: { username: "phoenix77", rank: "GOLD II" },
    player2: { username: "shadowfox", rank: "GOLD I" },
    game: "Chess",
    bet: 500,
  },
  {
    player1: { username: "AX", rank: "PLATINUM I" },
    player2: { username: "kira_06", rank: "GOLD III" },
    game: "Chess",
    bet: 750,
  },
  {
    player1: { username: "nova_xx", rank: "DIAMOND" },
    player2: { username: "drift99", rank: "PLATINUM II" },
    game: "Chess",
    bet: 1000,
  },
];

// Italian Game opening — recognizable, dramatic-looking, balanced positions
export const fabricatedMoveSequence = [
  { from: "e2", to: "e4", piece: "♙" },
  { from: "e7", to: "e5", piece: "♟" },
  { from: "g1", to: "f3", piece: "♘" },
  { from: "b8", to: "c6", piece: "♞" },
  { from: "f1", to: "c4", piece: "♗" },
  { from: "g8", to: "f6", piece: "♞" },
  { from: "b1", to: "c3", piece: "♘" },
  { from: "f8", to: "c5", piece: "♝" },
];
