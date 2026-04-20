"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { getCurrentUser } from "@/lib/api";

const DEV_SP_GRANT_AMOUNT = 5000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DevSpGrantButtonProps = {
  isDevMode: boolean;
};

export default function DevSpGrantButton({ isDevMode }: DevSpGrantButtonProps) {
  const { showToast } = useToast();
  const [granting, setGranting] = useState(false);

  if (!isDevMode) return null;

  async function resolveTargetUserId(): Promise<string | null> {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;

    if (UUID_RE.test(currentUser.id)) {
      return currentUser.id;
    }

    const supabase = createClient();
    if (!supabase) return null;

    // Prefer the session UID when present.
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (authUser?.id && UUID_RE.test(authUser.id)) {
      return authUser.id;
    }

    // Dev mode may use a local user object with a non-UUID ID.
    // Resolve by username to target the same row the app displays.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", currentUser.username)
      .maybeSingle();

    if (profile?.id && UUID_RE.test(profile.id)) {
      return profile.id;
    }

    return null;
  }

  async function handleGrantSp() {
    if (granting) return;
    setGranting(true);

    try {
      const supabase = createClient();
      if (!supabase) {
        showToast("Supabase is not configured.", "error");
        return;
      }

      const targetUserId = await resolveTargetUserId();
      if (!targetUserId) {
        showToast("Unable to resolve profile for developer SP grant.", "error");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("lifetime_sp, balance_sp")
        .eq("id", targetUserId)
        .single();

      if (profileError || !profile) {
        showToast("Unable to load profile SkillPoints.", "error");
        return;
      }

      const currentLifetime = Number(profile.lifetime_sp ?? 0);
      const currentBalance = Number(profile.balance_sp ?? 0);
      const nextLifetime = currentLifetime + DEV_SP_GRANT_AMOUNT;
      const nextBalance = currentBalance + DEV_SP_GRANT_AMOUNT;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          lifetime_sp: nextLifetime,
          balance_sp: nextBalance,
        })
        .eq("id", targetUserId);

      if (updateError) {
        showToast("Failed to apply SP grant.", "error");
        return;
      }

      const { error: txError } = await supabase.from("sp_transactions").insert({
        user_id: targetUserId,
        amount: DEV_SP_GRANT_AMOUNT,
        type: "dev_grant",
        description: "Developer mode SP grant (+5000)",
      });

      if (txError) {
        await supabase
          .from("profiles")
          .update({
            lifetime_sp: currentLifetime,
            balance_sp: currentBalance,
          })
          .eq("id", targetUserId);
        showToast("Failed to log SP grant transaction.", "error");
        return;
      }

      showToast("Added 5,000 SP.", "success");
      window.location.reload();
    } catch {
      showToast("Unexpected error while granting SP.", "error");
    } finally {
      setGranting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleGrantSp}
      disabled={granting}
      className="fixed bottom-4 left-4 z-[70] flex h-11 w-11 items-center justify-center rounded-full border border-purple/50 bg-purple text-xs font-bold text-white shadow-[0_0_14px_rgba(168,85,247,0.45)] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
      aria-label="Grant 5000 SkillPoints"
      title="Grant 5,000 SP"
    >
      {granting ? "..." : "+SP"}
    </button>
  );
}
