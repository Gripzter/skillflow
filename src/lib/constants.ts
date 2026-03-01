/**
 * Centralized platform fee and wallet limits.
 * Change these in one place to update the entire platform.
 */

/** Match platform fee (from total pot). Example: 0.05 = 5% */
export const PLATFORM_FEE_PERCENT = 0.05;

/** Withdrawal processing fee. Example: 0.03 = 3% */
export const WITHDRAWAL_FEE_PERCENT = 0.03;

export const MIN_DEPOSIT = 5;
export const MAX_DEPOSIT = 500;
export const MIN_WITHDRAWAL = 10;
