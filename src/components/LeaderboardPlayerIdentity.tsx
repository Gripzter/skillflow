"use client";

import AvatarWithBorder from "@/components/AvatarWithBorder";
import EquippedBadgesRow from "@/components/EquippedBadgesRow";
import RankBadge from "@/components/RankBadge";
import type { LeaderboardPlayer } from "@/lib/leaderboard-data";

type Props = {
  player: LeaderboardPlayer;
  showRankBadge?: boolean;
  avatarSize?: "sm" | "md";
};

export default function LeaderboardPlayerIdentity({
  player,
  showRankBadge = false,
  avatarSize = "sm",
}: Props) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <AvatarWithBorder
        src={player.avatarUrl}
        fallbackInitial={player.username}
        size={avatarSize}
        border={player.equippedBorder}
        fallbackBg="linear-gradient(135deg, rgba(20,184,166,0.4), rgba(168,85,247,0.4))"
      />
      {showRankBadge ? <RankBadge tier={player.rankTier ?? "bronze"} /> : null}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-white">{player.username}</span>
          <EquippedBadgesRow badges={player.equippedBadges ?? []} size="sm" />
        </div>
      </div>
    </div>
  );
}
