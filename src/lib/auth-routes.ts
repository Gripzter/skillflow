const PROTECTED_ROUTE_PREFIXES = [
  "/admin",
  "/dashboard",
  "/external/match",
  "/last-touch",
  "/match",
  "/play",
  "/profile",
  "/settings",
  "/skillpoints",
  "/wallet",
] as const;

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string) {
  if (
    pathname === "/" ||
    pathname === "/play" ||
    matchesPrefix(pathname, "/events") ||
    matchesPrefix(pathname, "/cases") ||
    matchesPrefix(pathname, "/inventory") ||
    matchesPrefix(pathname, "/leaderboard") ||
    matchesPrefix(pathname, "/referrals") ||
    matchesPrefix(pathname, "/login") ||
    matchesPrefix(pathname, "/signup") ||
    matchesPrefix(pathname, "/auth") ||
    matchesPrefix(pathname, "/founders") ||
    matchesPrefix(pathname, "/fairplay") ||
    matchesPrefix(pathname, "/legal") ||
    matchesPrefix(pathname, "/terms") ||
    matchesPrefix(pathname, "/privacy") ||
    matchesPrefix(pathname, "/acceptable-use")
  ) {
    return false;
  }

  if (matchesPrefix(pathname, "/admin/login")) {
    return false;
  }

  return PROTECTED_ROUTE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function getAuthRedirectPath(pathname: string) {
  return matchesPrefix(pathname, "/admin") ? "/admin/login" : "/login";
}
