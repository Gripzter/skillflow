"use client";

export const RETURNING_USER_KEY = "sf_returning_user";

export function markReturningUser() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RETURNING_USER_KEY, "true");
}

function hasSupabaseAuthArtifacts() {
  if (typeof window === "undefined") return false;

  const hasLocalStorageToken = Object.keys(window.localStorage).some(
    (key) => key.startsWith("sb-") && key.endsWith("-auth-token")
  );
  const hasCookieToken = document.cookie.split(";").some((cookie) => cookie.trim().startsWith("sb-"));

  return hasLocalStorageToken || hasCookieToken;
}

export function getAuthActionRedirectPath() {
  if (typeof window === "undefined") return "/signup";

  const returningUser = window.localStorage.getItem(RETURNING_USER_KEY) === "true";
  if (returningUser || hasSupabaseAuthArtifacts()) {
    return "/login";
  }
  return "/signup";
}

export function redirectToAuthAction() {
  if (typeof window === "undefined") return;
  window.location.href = getAuthActionRedirectPath();
}
