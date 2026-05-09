export const VALID_SP_AMOUNTS = [50, 100, 200, 500, 1000, 2000, 5000] as const;
export type ValidSpAmount = typeof VALID_SP_AMOUNTS[number];

/**
 * Returns the closest valid SP amount, used for displaying ticker entries and bets.
 * If the raw amount is non-standard (e.g. due to multipliers, daily bonus, etc.),
 * we floor to the nearest valid amount so the public display always looks logical.
 */
export function nearestValidSpAmount(rawAmount: number): ValidSpAmount {
  if (rawAmount <= 0) return 50;
  // Find the largest valid amount that is <= rawAmount
  for (let i = VALID_SP_AMOUNTS.length - 1; i >= 0; i -= 1) {
    if (VALID_SP_AMOUNTS[i] <= rawAmount) {
      return VALID_SP_AMOUNTS[i];
    }
  }
  return 50;
}

/**
 * Returns true if the amount is a valid base SP win (matches a standard bet denomination).
 * Used for filtering ticker entries to ensure displayed wins always make sense.
 */
export function isValidSpWinAmount(amount: number): boolean {
  return (VALID_SP_AMOUNTS as readonly number[]).includes(amount);
}
