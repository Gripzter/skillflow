"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { realtimeManager } from "@/lib/multiplayer/realtime";
import type { GameEventPayload } from "@/lib/multiplayer/realtime";

export interface UseMultiplayerProps {
  matchId: string;
  userId: string;
  onGameEvent: (event: GameEventPayload & { type?: string }) => void;
}

export function useMultiplayer({ matchId, userId, onGameEvent }: UseMultiplayerProps) {
  const [connected, setConnected] = useState(false);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const [playersOnline, setPlayersOnline] = useState<string[]>([]);
  const eventHandlerRef = useRef(onGameEvent);
  eventHandlerRef.current = onGameEvent;

  useEffect(() => {
    if (!matchId || !userId) return;

    const handleEvent = (event: GameEventPayload & { type: string }) => {
      if (event.type === "presence_sync") {
        const players = (event as { players: string[] }).players ?? [];
        setPlayersOnline(players);
        setOpponentConnected(players.length >= 2);
      } else if (event.type === "player_joined") {
        setOpponentConnected(true);
      } else if (event.type === "player_left") {
        setOpponentConnected(false);
        eventHandlerRef.current({ type: "opponent_disconnected" });
      } else {
        eventHandlerRef.current(event);
      }
    };

    realtimeManager.joinChannel(matchId, userId, handleEvent).then((ch) => {
      setConnected(!!ch);
    });

    return () => {
      realtimeManager.leaveChannel();
      setConnected(false);
      setOpponentConnected(false);
      setPlayersOnline([]);
    };
  }, [matchId, userId]);

  const sendGameEvent = useCallback(async (event: GameEventPayload) => {
    await realtimeManager.sendEvent(event);
  }, []);

  return { connected, opponentConnected, playersOnline, sendGameEvent };
}
