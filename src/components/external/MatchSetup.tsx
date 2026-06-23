"use client";

import { useState } from "react";
import type { ExternalMatch, ChatMessage } from "@/lib/external-matches";

interface MatchSetupProps {
  match: ExternalMatch;
  isPlayer1: boolean;
  onReady: () => void;
  onCancel: () => void;
  onLobbyCodeSubmit: (code: string) => void;
  onChatSend: (msg: Omit<ChatMessage, "id">) => void;
  canCancel: boolean;
}

export default function MatchSetup({
  match,
  isPlayer1,
  onReady,
  onCancel,
  onLobbyCodeSubmit,
  onChatSend,
  canCancel,
}: MatchSetupProps) {
  const [lobbyCode, setLobbyCode] = useState("");
  const [chatInput, setChatInput] = useState("");
  const opponentSteam = isPlayer1 ? match.player2.steamId : match.player1.steamId;
  const opponentUsername = isPlayer1 ? match.player2.username : match.player1.username;
  const playerReady = isPlayer1 ? match.player1Ready : match.player2Ready;
  const otherReady = isPlayer1 ? match.player2Ready : match.player1Ready;

  const handleCopySteamId = () => {
    if (opponentSteam) {
      navigator.clipboard.writeText(opponentSteam);
    }
  };

  const handleSubmitLobbyCode = () => {
    if (lobbyCode.trim()) {
      onLobbyCodeSubmit(lobbyCode.trim());
    }
  };

  const handleSendMessage = () => {
    if (chatInput.trim()) {
      onChatSend({
        sender: isPlayer1 ? "player1" : "player2",
        text: chatInput.trim(),
        timestamp: new Date().toISOString(),
      });
      setChatInput("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="card-border rounded-card bg-card p-6">
        <h3 className="text-lg font-bold text-white">How to Play</h3>
        <ol className="mt-4 space-y-4 text-sm text-body-gray">
          <li>
            <span className="font-semibold text-white">1. Add your opponent on Steam</span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded bg-white/5 px-2 py-1 font-mono text-white">
                {opponentSteam || opponentUsername}
              </span>
              <button
                type="button"
                onClick={handleCopySteamId}
                className="rounded-lg border border-teal/50 px-3 py-1.5 text-xs font-medium text-teal hover:bg-teal/10"
              >
                Copy Steam ID
              </button>
            </div>
          </li>
          <li>
            <span className="font-semibold text-white">2. Create or join the private match</span>
            <p className="mt-1">One of you creates a private competitive match. Share the lobby code with your opponent.</p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                placeholder="Enter Lobby Code"
                value={lobbyCode}
                onChange={(e) => setLobbyCode(e.target.value)}
                className="flex-1 rounded-lg border border-white/10 bg-[#1A1D27] px-4 py-2 text-white placeholder:text-body-gray focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
              />
              <button
                type="button"
                onClick={handleSubmitLobbyCode}
                className="rounded-lg bg-teal px-4 py-2 text-sm font-medium text-charcoal hover:shadow-teal-glow"
              >
                Submit
              </button>
            </div>
          </li>
          <li>
            <span className="font-semibold text-white">3. Play the match following the agreed rules</span>
            <p className="mt-1">
              Mode: {match.mode === "1v1-aim-duel" ? "1v1 Aim Duel — First to 16 kills" : "1v1 Competitive (MR12)"} • Map:{" "}
              {match.map === "random" ? "Any" : match.map}
            </p>
          </li>
          <li>
            <span className="font-semibold text-white">4. Report your result below when finished</span>
          </li>
        </ol>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onReady}
            disabled={playerReady}
            className={`rounded-lg px-6 py-3 font-semibold transition-all ${
              playerReady
                ? "cursor-default border border-teal/50 bg-teal/20 text-teal"
                : "bg-teal text-charcoal hover:shadow-teal-glow"
            }`}
          >
            {playerReady ? "Ready " : "Ready"}
          </button>
          {otherReady && !playerReady && (
            <span className="text-sm text-body-gray">Opponent is ready. Click Ready when you are.</span>
          )}
          {playerReady && !otherReady && (
            <span className="text-sm text-body-gray">Waiting for opponent...</span>
          )}
        </div>
        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
          >
            Cancel Match
          </button>
        )}
      </div>
    </div>
  );
}
