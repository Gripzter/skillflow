# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Run ESLint
npm start        # Start production server
```

No test runner is configured. ESLint and TypeScript errors are ignored during builds (see `next.config.js`).

## Environment

Requires `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Architecture

SkillFlow is a skill-based wagering platform (Next.js 14 App Router + Supabase + Stripe) where players compete head-to-head in 8 games for real or practice stakes.

### Dev Mode vs Real Mode

A key architectural pattern: the app checks `skillflow_dev_mode` in localStorage. In dev mode, all data (wallet, matches, users) is stored in localStorage — no Supabase calls needed. In real mode, all data goes through Supabase. The central abstraction for this is `src/lib/api.ts`, which routes calls to either localStorage or Supabase depending on the mode.

### Data Flow

```
Component → lib/api.ts → Supabase (real) | localStorage (dev)
```

Game logic is isolated in `lib/games/*` utilities and kept separate from UI components. Game components in `components/games/` consume these utilities and receive multiplayer props from `GameLayout`.

### Game Component Interface

All game components follow this multiplayer props interface (`components/game/matchUi.ts`):

```typescript
interface GameMultiplayerProps {
  isMultiplayer?: boolean;
  myRole?: "player1" | "player2";
  sendGameEvent?: (event: Record<string, unknown>) => Promise<void>;
  incomingEvent?: Record<string, unknown> | null;
  onEventProcessed?: () => void;
  onMatchUi?: (state: MatchUiState) => void;
}
```

Games can run standalone (single-player vs bot) or in multiplayer mode where moves are synced as JSON events through Supabase Realtime channels.

### Multiplayer Infrastructure

- `lib/multiplayer/realtime.ts` — Supabase Realtime setup
- `lib/multiplayer/game-channel.ts` — Game event channels
- `lib/multiplayer/matchmaking.ts` — Real-time matchmaking queue
- `hooks/useMatchmaking.ts` — Hook for matchmaking flow
- `hooks/useMultiplayer.ts` — Hook for in-game event sync

Matchmaking either pairs two real players or falls back to a bot opponent.

### Match Lifecycle

1. Match created → stake deducted from wallet
2. Matchmaking → real opponent found or bot assigned
3. Game played → real-time event sync via Supabase Realtime
4. Result reported → payout distributed (winner receives stake×2 minus platform fee)

### Contexts

- `PlayModeContext` — toggles between Real (money) and Practice (free) mode; drives UI color scheme (orange/teal for real, purple for practice)
- `GeoContext` — detects user location, enforces geo-restrictions, forces practice mode in restricted regions

### Routing

- `/play/[game]` — dynamic game page (game names: chess, checkers, connect-four, pool, memory, reaction, spelling, last-touch)
- `/match/[id]` — post-match summary
- `/admin/*` — protected admin dashboard (separate auth via `lib/admin-auth.ts`)
- `/external/*` — embeddable match setup/viewing for external use
- `/api/stripe/*` — Stripe webhook and payment endpoints

### Tailwind Theme

Custom colors defined in `tailwind.config.ts`: `charcoal`, `card`, `border` (dark UI base), `primary-text`. Accent colors: orange/teal for real-money mode, purple for practice mode. Use these semantic names rather than raw hex values.

### Path Alias

`@/*` maps to `./src/*` — use this for all internal imports.
