/**
 * Shared wallet helpers for dev mode (localStorage).
 * Used by wallet page, play lobby, and match outcome flows.
 */

export const WALLET_BALANCE_KEY = "skillflow_wallet_balance";
export const TRANSACTIONS_KEY = "skillflow_transactions";

export type TransactionType =
  | "deposit"
  | "withdrawal"
  | "match_entry"
  | "match_win"
  | "match_refund"
  | "platform_fee";

export interface StoredTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  balance_after: number;
  description?: string;
  created_at: string;
  /** For withdrawals: 'pending' | 'processing' | 'completed' */
  status?: string;
}

export function getWalletBalance(): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(WALLET_BALANCE_KEY);
  return raw != null ? parseFloat(raw) || 0 : 0;
}

export function setWalletBalance(value: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(WALLET_BALANCE_KEY, String(value));
}

export function getStoredTransactions(): StoredTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addStoredTransaction(tx: StoredTransaction): void {
  const list = getStoredTransactions();
  list.unshift(tx);
  if (typeof window !== "undefined") {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(list));
  }
}

export function generateId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2);
}
