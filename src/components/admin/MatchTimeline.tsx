"use client";

type TimelineEvent = {
  id: string;
  eventType: string;
  playerName: string | null;
  playerId: string | null;
  payload: unknown;
  reactionTimeMs: number | null;
  createdAt: string;
};

export default function MatchTimeline({
  events,
  hasEventData,
}: {
  events: TimelineEvent[];
  hasEventData: boolean;
}) {
  if (!hasEventData || events.length === 0) {
    return (
      <p className="rounded-lg border border-white/5 bg-[#0E0E12] p-6 text-center text-sm lowercase text-[#7A7A8E]">
        legacy match — no event data available
      </p>
    );
  }

  return (
    <div className="relative space-y-4 pl-6 before:absolute before:bottom-0 before:left-2 before:top-0 before:w-px before:bg-white/10">
      {events.map((e) => {
        const isPlayer1 = e.eventType.includes("player") || e.playerId;
        const fast = e.reactionTimeMs != null && e.reactionTimeMs < 100;
        return (
          <div key={e.id} className="relative">
            <span className="absolute -left-[18px] top-2 h-2.5 w-2.5 rounded-full bg-[#FFFF00]" />
            <div
              className={`rounded-lg border p-4 ${
                isPlayer1 ? "ml-0 mr-8 border-white/10" : "ml-8 mr-0 border-[#FFFF00]/20"
              } bg-[#0E0E12]`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs lowercase text-[#7A7A8E]">
                <span className="text-white">{e.eventType.replace(/_/g, " ")}</span>
                <span>{new Date(e.createdAt).toLocaleTimeString()}</span>
              </div>
              {e.playerName ? (
                <p className="mt-1 text-sm text-[#C8C8D4]">{e.playerName}</p>
              ) : null}
              {e.reactionTimeMs != null ? (
                <p className={`mt-1 text-xs ${fast ? "text-red-400" : "text-[#7A7A8E]"}`}>
                  reaction: {e.reactionTimeMs}ms {fast ? " inhuman" : ""}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
