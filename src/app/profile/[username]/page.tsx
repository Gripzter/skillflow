"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

/**
 * Viewing another player's profile. For now redirect to own profile.
 * Placeholder for future: fetch player by username and show their public profile.
 */
export default function ProfileUsernamePage() {
  const router = useRouter();
  const params = useParams();
  const username = params?.username as string | undefined;

  useEffect(() => {
    if (username) {
      router.replace("/profile");
    }
  }, [router, username]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal">
      <p className="text-body-gray">Redirecting to your profile...</p>
    </div>
  );
}
