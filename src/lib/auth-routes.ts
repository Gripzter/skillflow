const PROTECTED_ROUTE_PREFIXES = [
  "/admin",
  "/cases",
  "/dashboard",
  "/events",
  "/external",
  "/inventory",
  "/last-touch",
  "/leaderboard",
  "/match",
  "/play",
  "/profile",
  "/referrals",
  "/settings",
  "/skillpoints",
  "/wallet",
] as const;

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string) {
  if (matchesPrefix(pathname, "/admin/login")) {
    return false;
  }
  return PROTECTED_ROUTE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function getAuthRedirectPath(pathname: string) {
  return matchesPrefix(pathname, "/admin") ? "/admin/login" : "/login";
}
