import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthRedirectPath, isProtectedPath } from "@/lib/auth-routes";

function applyNoCacheHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedPath = isProtectedPath(pathname);
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (protectedPath) {
      const redirect = NextResponse.redirect(new URL(getAuthRedirectPath(pathname), request.url));
      applyNoCacheHeaders(redirect);
      return redirect;
    }
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (protectedPath && !user) {
    const redirect = NextResponse.redirect(new URL(getAuthRedirectPath(pathname), request.url));
    applyNoCacheHeaders(redirect);
    return redirect;
  }

  if (protectedPath) {
    applyNoCacheHeaders(response);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
