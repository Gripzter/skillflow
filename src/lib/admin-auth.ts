/**
 * Admin authentication for SkillFlow admin dashboard.
 * Temporary: hardcoded admin code. Replace with proper auth (e.g. Supabase admin role) later.
 */

export const ADMIN_AUTH_KEY = "skillflow_admin_auth";
export const ADMIN_CODE = "SK-ADMIN-2026";

export function isAdminAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ADMIN_AUTH_KEY) === "true";
}

export function setAdminAuthenticated(value: boolean): void {
  if (typeof window === "undefined") return;
  if (value) {
    localStorage.setItem(ADMIN_AUTH_KEY, "true");
  } else {
    localStorage.removeItem(ADMIN_AUTH_KEY);
  }
}

export function verifyAdminCode(code: string): boolean {
  return code.trim() === ADMIN_CODE;
}

export function adminLogin(code: string): boolean {
  if (!verifyAdminCode(code)) return false;
  setAdminAuthenticated(true);
  return true;
}

export function adminLogout(): void {
  setAdminAuthenticated(false);
}
