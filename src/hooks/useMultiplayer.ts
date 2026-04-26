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
  const playersOnlineRef = useRef<string[]>([]);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!matchId || !userId) return;

    const handleEvent = (event: GameEventPayload & { type: string }) => {
      if (event.type === "presence_sync") {
        const players = (event as { players: string[] }).players ?? [];
        playersOnlineRef.current = players;
        setPlayersOnline(players);
        setOpponentConnected(players.length >= 2);
      } else if (event.type === "player_joined") {
        const joinedUserId = (event as { userId?: string }).userId;
        if (joinedUserId && joinedUserId !== userId) {
          setOpponentConnected(true);
        }
      } else if (event.type === "player_left") {
        const leftUserId = (event as { userId?: string }).userId;
        if (!leftUserId || leftUserId === userId) {
          return;
        }
        // Presence leave can be transient during reconnect. Wait for sync to settle.
        if (disconnectTimerRef.current) {
          clearTimeout(disconnectTimerRef.current);
        }
        disconnectTimerRef.current = setTimeout(() => {
          disconnectTimerRef.current = null;
          const stillOnlyMeOnline = playersOnlineRef.current.length < 2;
          if (stillOnlyMeOnline) {
            setOpponentConnected(false);
            eventHandlerRef.current({ type: "opponent_disconnected" });
          }
        }, 1200);
      } else {
        eventHandlerRef.current(event);
      }
    };

    realtimeManager.joinChannel(matchId, userId, handleEvent).then((ch) => {
      setConnected(!!ch);
    });

    return () => {
      if (disconnectTimerRef.current) {
        clearTimeout(disconnectTimerRef.current);
        disconnectTimerRef.current = null;
      }
      realtimeManager.leaveChannel();
      setConnected(false);
      setOpponentConnected(false);
      setPlayersOnline([]);
      playersOnlineRef.current = [];
    };
  }, [matchId, userId]);

  const sendGameEvent = useCallback(async (event: GameEventPayload) => {
    await realtimeManager.sendEvent(event);
  }, []);

  return { connected, opponentConnected, playersOnline, sendGameEvent };
}
