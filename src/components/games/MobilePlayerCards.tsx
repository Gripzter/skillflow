import { displayUsername } from "@/components/games/GamePlayerStrip";

const ACCENT_P1 = "#FF5E00"; // orange
const ACCENT_P2 = "#A855F7"; // purple

type MobilePlayerCardsProps = {
  player1Name: string;
  player1Right: string;
  player2Name: string;
  player2Right: string;
  player1Active: boolean;
  player2Active: boolean;
};

export function MobilePlayerCards({
  player1Name,
  player1Right,
  player2Name,
  player2Right,
  player1Active,
  player2Active,
}: MobilePlayerCardsProps) {
  return (
    <div className="flex h-[60px] w-full shrink-0 items-center gap-2 px-2">
      <div
        className="flex flex-1 items-center justify-between rounded-lg border bg-[#1A1A22] px-[10px] py-[6px]"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          borderLeftWidth: player1Active ? 4 : 2,
          borderLeftStyle: "solid",
          borderLeftColor: player1Active ? ACCENT_P1 : "rgba(255,255,255,0.08)",
        }}
      >
        <span className="min-w-0 max-w-[9.5ch] truncate text-[13px] font-medium text-white/90" title={player1Name}>
          {displayUsername(player1Name, 12)}
        </span>
        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-white/90">{player1Right}</span>
      </div>

      <div
        className="flex flex-1 items-center justify-between rounded-lg border bg-[#1A1A22] px-[10px] py-[6px]"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          borderLeftWidth: player2Active ? 4 : 2,
          borderLeftStyle: "solid",
          borderLeftColor: player2Active ? ACCENT_P2 : "rgba(255,255,255,0.08)",
        }}
      >
        <span className="min-w-0 max-w-[9.5ch] truncate text-[13px] font-medium text-white/90" title={player2Name}>
          {displayUsername(player2Name, 12)}
        </span>
        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-white/90">{player2Right}</span>
      </div>
    </div>
  );
}

