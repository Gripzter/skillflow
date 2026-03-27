/**
 * Glicko-2 Rating Algorithm
 * Based on Mark Glickman's Glicko-2 system (http://www.glicko.net/glicko.html)
 *
 * Converts between Glicko-1 scale (rating ~1000-2000, RD ~30-350)
 * and Glicko-2 scale (mu, phi, sigma).
 */

const SCALE = 173.7178;
const TAU = 0.5; // system constant — constrains how much volatility can change each period

/** g(φ): reduction factor for opponent's uncertainty */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

/** E(μ, μⱼ, φⱼ): expected score against opponent */
function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/** Convert Glicko-1 → Glicko-2 scale */
function toG2(rating: number, rd: number): { mu: number; phi: number } {
  return { mu: (rating - 1500) / SCALE, phi: rd / SCALE };
}

/** Convert Glicko-2 → Glicko-1 scale */
function fromG2(mu: number, phi: number): { rating: number; rd: number } {
  return { rating: SCALE * mu + 1500, rd: SCALE * phi };
}

/**
 * Illinois algorithm (secant-method variant) to find new volatility σ'.
 * Solves: f(x) = 0  where x = ln(σ'²).
 */
function newVolatility(phi: number, sigma: number, delta: number, v: number): number {
  const eps = 1e-6;
  const a = Math.log(sigma * sigma);

  const f = (x: number): number => {
    const ex = Math.exp(x);
    const phi2 = phi * phi;
    return (
      (ex * (delta * delta - phi2 - v - ex)) /
        (2 * Math.pow(phi2 + v + ex, 2)) -
      (x - a) / (TAU * TAU)
    );
  };

  let A = a;
  let B: number;

  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);

  while (Math.abs(B - A) > eps) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);

    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }

  return Math.exp(A / 2);
}

/** Internal: compute one player's updated Glicko-2 values against a single opponent */
function updatePlayer(
  mu: number,
  phi: number,
  sigma: number,
  oppMu: number,
  oppPhi: number,
  score: number // 1=win, 0.5=draw, 0=loss
): { mu: number; phi: number; sigma: number } {
  const gOpp = g(oppPhi);
  const eOpp = E(mu, oppMu, oppPhi);

  // Estimated variance of the player's rating based on game outcomes
  const v = 1 / (gOpp * gOpp * eOpp * (1 - eOpp));

  // Estimated improvement
  const delta = v * gOpp * (score - eOpp);

  const newSigma = newVolatility(phi, sigma, delta, v);

  // Pre-rating period deviation (accounts for new uncertainty from volatility)
  const phiStar = Math.sqrt(phi * phi + newSigma * newSigma);

  // New phi
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);

  // New mu
  const newMu = mu + newPhi * newPhi * gOpp * (score - eOpp);

  return { mu: newMu, phi: newPhi, sigma: newSigma };
}

export interface PlayerRatingInput {
  rating: number;
  rd: number;
  volatility: number;
  matchesPlayed: number;
}

export interface PlayerRatingOutput {
  rating: number;
  rd: number;
  volatility: number;
  ratingChange: number;
}

/**
 * Calculate new Glicko-2 ratings for both players after a match.
 *
 * During placement (matchesPlayed < 10) the rating *change* is amplified 3×
 * to converge faster to the player's true skill.
 */
export function calculateNewRatings(
  p1: PlayerRatingInput,
  p2: PlayerRatingInput,
  outcome: "player1" | "player2" | "draw"
): { player1: PlayerRatingOutput; player2: PlayerRatingOutput } {
  // Map outcome to scores
  const s1 = outcome === "player1" ? 1 : outcome === "draw" ? 0.5 : 0;
  const s2 = 1 - s1;

  // Convert to Glicko-2 scale
  const g1 = toG2(p1.rating, p1.rd);
  const g2 = toG2(p2.rating, p2.rd);

  // Compute new Glicko-2 values
  const r1 = updatePlayer(g1.mu, g1.phi, p1.volatility, g2.mu, g2.phi, s1);
  const r2 = updatePlayer(g2.mu, g2.phi, p2.volatility, g1.mu, g1.phi, s2);

  // Convert back to Glicko-1 scale
  const out1 = fromG2(r1.mu, r1.phi);
  const out2 = fromG2(r2.mu, r2.phi);

  // Placement multiplier: players with < 10 matches get 3× the rating change
  const applyMultiplier = (
    baseRating: number,
    newRating: number,
    matchesPlayed: number
  ): number => {
    const change = newRating - baseRating;
    return matchesPlayed < 10 ? baseRating + change * 3 : newRating;
  };

  const final1Rating = applyMultiplier(p1.rating, out1.rating, p1.matchesPlayed);
  const final2Rating = applyMultiplier(p2.rating, out2.rating, p2.matchesPlayed);

  return {
    player1: {
      rating: final1Rating,
      rd: out1.rd,
      volatility: r1.sigma,
      ratingChange: final1Rating - p1.rating,
    },
    player2: {
      rating: final2Rating,
      rd: out2.rd,
      volatility: r2.sigma,
      ratingChange: final2Rating - p2.rating,
    },
  };
}
