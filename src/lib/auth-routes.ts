const PROTECTED_ROUTE_PREFIXES = [
  "/admin",
  "/creator",
  "/dashboard",
  "/external/match",
  "/last-touch",
  "/match",
  "/play",
  "/profile",
  "/settings",
  "/wallet",
] as const;

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** QR in-person flow: join, stake, and guest match play must work without auth */
function isQrPublicPath(pathname: string) {
  return matchesPrefix(pathname, "/join") || matchesPrefix(pathname, "/qr");
}

export function isProtectedPath(pathname: string, searchParams?: URLSearchParams) {
  if (isQrPublicPath(pathname)) {
    return false;
  }

  // Anonymous QR opponents play matches with ?guest=1
  if (matchesPrefix(pathname, "/match") && searchParams?.get("guest") === "1") {
    return false;
  }

  if (
    pathname === "/" ||
    pathname === "/play" ||
    matchesPrefix(pathname, "/events") ||
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

  if (matchesPrefix(pathname, "/creator/not-found")) {
    return false;
  }

  return PROTECTED_ROUTE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function getAuthRedirectPath(pathname: string) {
  if (matchesPrefix(pathname, "/admin")) return "/admin/login";
  if (matchesPrefix(pathname, "/creator")) return "/login";
  return "/login";
}
