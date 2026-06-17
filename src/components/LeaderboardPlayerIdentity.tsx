"use client";

import AvatarWithBorder from "@/components/AvatarWithBorder";
import type { LeaderboardPlayer } from "@/lib/leaderboard-data";

type Props = {
  player: LeaderboardPlayer;
  avatarSize?: "sm" | "md";
};

export default function LeaderboardPlayerIdentity({
  player,
  avatarSize = "sm",
}: Props) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <AvatarWithBorder
        src={player.avatarUrl}
        fallbackInitial={player.username}
        size={avatarSize}
        fallbackBg="linear-gradient(135deg, rgba(20,184,166,0.4), rgba(168,85,247,0.4))"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-white">{player.username}</span>
        </div>
      </div>
    </div>
  );
}
