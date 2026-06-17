"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { getAuthRedirectPath, isProtectedPath } from "@/lib/auth-routes";

type AuthSessionGuardProps = {
  children: ReactNode;
};

function getSearchParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export default function AuthSessionGuard({ children }: AuthSessionGuardProps) {
  const pathname = usePathname();
  const [checking, setChecking] = useState(() => isProtectedPath(pathname));
  const [authenticated, setAuthenticated] = useState(() => !isProtectedPath(pathname));

  useEffect(() => {
    let cancelled = false;
    const searchParams = getSearchParams();
    const protectedPath = isProtectedPath(pathname, searchParams);

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

  const searchParams = typeof window !== "undefined" ? getSearchParams() : new URLSearchParams();
  if (isProtectedPath(pathname, searchParams) && (checking || !authenticated)) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: '#0E0E12',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: '3px solid #333',
          borderTop: '3px solid #FFFF00',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return <>{children}</>;
}
