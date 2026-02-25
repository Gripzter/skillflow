/**
 * Supabase Realtime connection manager for match channels.
 * Each match uses channel `match:{matchId}` for game events and presence.
 */

import { createClient } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type GameEventPayload = Record<string, unknown> & { type?: string };

export class RealtimeManager {
  private channel: RealtimeChannel | null = null;
  private matchId = "";

  private getSupabase() {
    return createClient();
  }

  /**
   * Join a match channel: subscribe to game_event broadcasts and presence.
   */
  async joinChannel(
    matchId: string,
    userId: string,
    onEvent: (event: GameEventPayload & { type: string }) => void
  ): Promise<RealtimeChannel | null> {
    const supabase = this.getSupabase();
    if (!supabase) return null;

    this.leaveChannel();
    this.matchId = matchId;

    this.channel = supabase.channel(`match:${matchId}`, {
      config: {
        presence: { key: userId },
        broadcast: { self: false },
      },
    });

    this.channel.on("broadcast", { event: "game_event" }, (payload: { payload: GameEventPayload }) => {
      const event = payload.payload as GameEventPayload & { type: string };
      onEvent(event?.type ? event : { ...event, type: "game_event" });
    });

    this.channel.on("presence", { event: "sync" }, () => {
      const state = this.channel?.presenceState() ?? {};
      onEvent({ type: "presence_sync", players: Object.keys(state) } as GameEventPayload & { type: string });
    });

    this.channel.on("presence", { event: "join" }, ({ key }: { key: string }) => {
      onEvent({ type: "player_joined", userId: key } as GameEventPayload & { type: string });
    });

    this.channel.on("presence", { event: "leave" }, ({ key }: { key: string }) => {
      onEvent({ type: "player_left", userId: key } as GameEventPayload & { type: string });
    });

    await this.channel.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        await this.channel?.track({ user_id: userId, online_at: new Date().toISOString() });
      }
    });

    return this.channel;
  }

  /** Send a game event to the channel (opponent receives via broadcast). */
  async sendEvent(event: GameEventPayload): Promise<void> {
    if (!this.channel) return;
    await this.channel.send({
      type: "broadcast",
      event: "game_event",
      payload: event,
    });
  }

  /** Leave the current channel and untrack presence. */
  async leaveChannel(): Promise<void> {
    if (this.channel) {
      await this.channel.untrack();
      await this.channel.unsubscribe();
      this.channel = null;
    }
    this.matchId = "";
  }

  getCurrentMatchId(): string {
    return this.matchId;
  }
}

export const realtimeManager = new RealtimeManager();

const ONLINE_CHANNEL_NAME = "online_players";
const MIN_FAKE_COUNT = 50;
const MAX_FAKE_COUNT = 150;

/**
 * Join the global "online_players" presence channel, track this user, and subscribe to count.
 * When real count < 5, reports a fake count (50–150) to avoid "empty" feel.
 * Returns cleanup function.
 */
export function subscribeOnlinePresence(
  userId: string,
  onCount: (count: number) => void
): () => void {
  const supabase = createClient();
  if (!supabase) return () => {};

  const channel = supabase.channel(ONLINE_CHANNEL_NAME, {
    config: { presence: { key: userId } },
  });

  channel.on("presence", { event: "sync" }, () => {
    const state = channel.presenceState();
    const realCount = Object.keys(state).length;
    const count =
      realCount < 5
        ? MIN_FAKE_COUNT + Math.floor(Math.random() * (MAX_FAKE_COUNT - MIN_FAKE_COUNT + 1))
        : realCount;
    onCount(count);
  });

  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({ user_id: userId, at: new Date().toISOString() });
    }
  });

  return () => {
    channel.untrack();
    channel.unsubscribe();
  };
}
