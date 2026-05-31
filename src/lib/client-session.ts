"use client";

import { createClient } from "@/lib/supabase";
import { COOKIE_CONSENT_KEY } from "@/lib/cookie-consent";

const SESSION_CLEARED_EVENT = "skillflow-session-cleared";

export function clearClientSessionState() {
  if (typeof window === "undefined") {
    return;
  }

  const consentValue = window.localStorage.getItem(COOKIE_CONSENT_KEY);
  window.localStorage.clear();
  if (consentValue) {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, consentValue);
  }
  window.sessionStorage.clear();
  window.dispatchEvent(new CustomEvent(SESSION_CLEARED_EVENT));
}

export async function signOutAndRedirect(redirectTo: string = "/login") {
  const supabase = createClient();

  try {
    if (supabase) {
      await supabase.auth.signOut();
    }
  } finally {
    clearClientSessionState();
    if (typeof window !== "undefined") {
      window.location.href = redirectTo;
    }
  }
}
