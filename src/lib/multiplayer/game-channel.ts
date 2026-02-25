/**
 * Game-specific event broadcasting over the match realtime channel.
 * Phase 2 will use these helpers to send typed move/action events.
 */

import { realtimeManager } from "./realtime";
import type { GameEventPayload } from "./realtime";

export type GameEventType =
  | "move"
  | "action"
  | "ready"
  | "rematch_request"
  | "game_event"
  | "opponent_disconnected";

/**
 * Send a game event to the opponent. Kept small (type + minimal data) for speed.
 */
export async function sendGameEvent(event: GameEventPayload): Promise<void> {
  await realtimeManager.sendEvent(event);
}
