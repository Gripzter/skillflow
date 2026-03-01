/**
 * US state geoblocking for skill-based wagering.
 * Restricted states where real-money play is prohibited or heavily restricted.
 * Keep this list in a constants file for easy updates.
 *
 * TODO: Revisit international (non-US) restrictions with gaming lawyer;
 * currently we allow all non-US and only block US restricted states (Option A).
 */

export const RESTRICTED_STATES = [
  "AZ", // Arizona
  "AR", // Arkansas
  "CT", // Connecticut
  "DE", // Delaware
  "LA", // Louisiana
  "MT", // Montana
  "SC", // South Carolina
  "SD", // South Dakota
  "TN", // Tennessee
] as const;

export type RestrictedStateCode = (typeof RESTRICTED_STATES)[number];

export interface GeoLocation {
  country: string;
  state: string;
  stateName: string;
  city: string;
  isRestricted: boolean;
  checkedAt: number;
}

/**
 * Detect user location via IP. Default to allowing access if API fails.
 * Uses ipapi.co (free tier: 1000 req/day).
 */
export async function detectUserLocation(): Promise<GeoLocation | null> {
  try {
    const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as {
      country_code?: string;
      region_code?: string;
      region?: string;
      city?: string;
    };
    const country = data.country_code ?? "";
    const state = (data.region_code ?? "").toUpperCase();
    const stateName = data.region ?? "";
    const city = data.city ?? "";
    const isRestricted =
      country === "US" && state.length === 2 && (RESTRICTED_STATES as readonly string[]).includes(state);
    return {
      country,
      state,
      stateName,
      city,
      isRestricted,
      checkedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

export const LOCATION_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
