"use client";

import { useState } from "react";
import {
  CreatorStatusBadge,
  CreatorWarningBanner,
  CreatorLoadingSpinner,
} from "@/components/creator/CreatorSidebar";
import { useCreatorProfile } from "@/hooks/useCreatorData";
import { createClient } from "@/lib/supabase";

const MASKED_KEY = "sk_live_••••••••••••";

export default function CreatorCredentialsPage() {
  const { profile, loading: profileLoading, isSuspended } = useCreatorProfile();
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (profileLoading || !profile) {
    return <CreatorLoadingSpinner />;
  }

  async function handleCopyGameId() {
    if (isSuspended) return;
    try {
      await navigator.clipboard.writeText(profile!.game_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setRevealError("failed to copy game id.");
    }
  }

  async function handleReveal() {
    if (isSuspended) return;
    setRevealError(null);
    setRevealing(true);

    try {
      const supabase = createClient();
      if (!supabase) {
        setRevealError("supabase is not configured.");
        return;
      }

      const { error: reauthError } = await supabase.auth.reauthenticate();
      if (reauthError) {
        setRevealError(
          reauthError.message ||
            "re-authentication required. check your email for a verification link, then try again."
        );
        return;
      }

      const { data, error } = await supabase.rpc("reveal_creator_api_key", {
        p_game_id: profile!.game_id,
      });

      if (error) {
        setRevealError(error.message);
        return;
      }

      setRevealedKey(data as string);
    } catch {
      setRevealError("failed to reveal api key.");
    } finally {
      setRevealing(false);
    }
  }

  function handleHide() {
    setRevealedKey(null);
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold lowercase text-white">sdk credentials</h1>

      {profile.status === "pending" ? (
        <div className="mb-6 rounded-lg border border-[#FFFF00]/30 bg-[#FFFF00]/10 px-4 py-3 text-sm text-[#FFFF00]">
          your game is pending review. you will be notified when approved.
        </div>
      ) : null}

      {profile.status === "suspended" ? (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          your game has been suspended. contact{" "}
          <a href="mailto:support@skillflow.gg" className="underline">
            support@skillflow.gg
          </a>
        </div>
      ) : null}

      <CreatorWarningBanner status={profile.status} />

      <div className="space-y-6">
        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs lowercase text-[#7A7A8E]">game name</p>
              <p className="mt-1 text-lg text-white">{profile.game_name}</p>
            </div>
            <CreatorStatusBadge status={profile.status} />
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs lowercase text-[#7A7A8E]">game id</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="rounded bg-[#0E0E12] px-3 py-2 font-mono text-sm text-[#FFFF00]">
                  {profile.game_id}
                </code>
                <button
                  type="button"
                  disabled={isSuspended}
                  onClick={() => void handleCopyGameId()}
                  className="rounded border border-white/10 px-3 py-2 text-xs lowercase text-[#C8C8D4] hover:bg-white/5 disabled:opacity-40"
                >
                  {copied ? "copied" : "copy"}
                </button>
              </div>
            </div>

            <div>
              <p className="text-xs lowercase text-[#7A7A8E]">api key</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded bg-[#0E0E12] px-3 py-2 font-mono text-sm text-[#C8C8D4]">
                  {revealedKey ?? MASKED_KEY}
                </code>
                {!revealedKey ? (
                  <button
                    type="button"
                    disabled={isSuspended || revealing}
                    onClick={() => void handleReveal()}
                    className="rounded px-3 py-2 text-xs font-medium lowercase text-black disabled:opacity-40"
                    style={{ background: "#FFFF00" }}
                  >
                    {revealing ? "verifying…" : "reveal"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleHide}
                    className="rounded border border-white/10 px-3 py-2 text-xs lowercase text-[#C8C8D4] hover:bg-white/5"
                  >
                    hide
                  </button>
                )}
              </div>
              {revealError ? (
                <p className="mt-2 text-xs text-red-400">{revealError}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#1A1A1F] p-5 text-sm text-[#7A7A8E]">
          <p className="lowercase">
            never expose your api key in client-side production code. use environment variables
            or a server-side proxy to sign sdk requests.
          </p>
        </div>
      </div>
    </div>
  );
}
