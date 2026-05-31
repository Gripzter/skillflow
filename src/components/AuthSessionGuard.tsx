"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { getAuthRedirectPath, isProtectedPath } from "@/lib/auth-routes";

type AuthSessionGuardProps = {
  children: ReactNode;
};

export default function AuthSessionGuard({ children }: AuthSessionGuardProps) {
  const pathname = usePathname();
  const [checking, setChecking] = useState(() => isProtectedPath(pathname));
  const [authenticated, setAuthenticated] = useState(() => !isProtectedPath(pathname));

  useEffect(() => {
    let cancelled = false;
    const protectedPath = isProtectedPath(pathname);

    if (!protectedPath) {
      setAuthenticated(true);
      setChecking(false);
      return;
    }

    setChecking(true);
    setAuthenticated(false);

    const supabase = createClient();
    if (!supabase) {
      window.location.href = getAuthRedirectPath(pathname);
      return;
    }

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) {
        return;
      }

      if (!session) {
        window.location.href = getAuthRedirectPath(pathname);
        return;
      }

      setAuthenticated(true);
      setChecking(false);
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (isProtectedPath(pathname) && (checking || !authenticated)) {
    return null;
  }

  return <>{children}</>;
}
