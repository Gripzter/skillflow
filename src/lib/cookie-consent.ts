export type CookieConsentValue = "all" | "essential";

export const COOKIE_CONSENT_KEY = "sf_cookie_consent";

export function isCookieConsentValue(value: string | null): value is CookieConsentValue {
  return value === "all" || value === "essential";
}

export function getCookieConsent(): CookieConsentValue | null {
  if (typeof window === "undefined") {
    return null;
  }
  const saved = window.localStorage.getItem(COOKIE_CONSENT_KEY);
  return isCookieConsentValue(saved) ? saved : null;
}

export function saveCookieConsent(value: CookieConsentValue) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
  document.cookie = `${COOKIE_CONSENT_KEY}=${value}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new CustomEvent("sf-cookie-consent-updated", { detail: value }));
}
