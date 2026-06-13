# SkillFlow Creator SDK — Integration Guide

The SkillFlow Creator SDK connects your game to the SkillFlow match lifecycle: stakes, winner reporting, and Skillie pot settlement. The SDK exposes **exactly four methods** and never returns wallet balances, player identity, or other financial data beyond entry stakes and pot size.

---

## Step 1: Copy the SDK into your project

Copy `skillflow-sdk.ts` from the SkillFlow repository into your game project:

```
your-game/
  lib/
    skillflow-sdk.ts   ← copy here (path is up to you)
```

The SDK has **no framework dependencies**. It works in vanilla JavaScript, React, Vue, Unity WebGL, or any environment with `fetch` and the Web Crypto API.

---

## Step 2: Get your credentials

1. Apply for Creator access at SkillFlow (invite only).
2. In the SkillFlow Creator Dashboard, create a game and note:
   - **gameId** — short slug, e.g. `blockade-v1`
   - **apiKey** — secret signing key, e.g. `sk_live_...`
3. SkillFlow pre-creates each match before your game loads. Pass the **matchId** (UUID) into `init()`.

**Security:** Never hard-code your `apiKey` in client-side source that ships to production. Load it from a server-side env variable or inject it at build time via `process.env.SKILLFLOW_API_KEY`.

---

## Step 3: Typical game loop

```typescript
import SkillFlow from "./lib/skillflow-sdk";

const GAME_ID = process.env.SKILLFLOW_GAME_ID!;
const API_KEY = process.env.SKILLFLOW_API_KEY!;
const MATCH_ID = new URLSearchParams(window.location.search).get("matchId")!;

async function runMatch() {
  // 1. Init — validate credentials, load match stakes
  const { player1Id, player2Id, entrySK, potSK } = await SkillFlow.init(
    GAME_ID,
    API_KEY,
    MATCH_ID
  );

  console.log(`Stakes: ${entrySK} SK each, pot ${potSK} SK`);
  showLoadingScreen();

  // 2. Match start — signal the game is ready (starts 300s timeout)
  const { timeoutSeconds } = await SkillFlow.matchStart();
  console.log(`Match live — must finish within ${timeoutSeconds}s`);

  // 3. Play your game...
  const winnerId = await playGame(player1Id, player2Id);

  // 4. Report winner — records claim with HMAC (does NOT pay out yet)
  await SkillFlow.reportWinner(winnerId);

  // 5. Match end — settles pot, applies rake, credits creator (call within 30s)
  const result = await SkillFlow.matchEnd();
  console.log(`Winner: ${result.winner}, rake: ${result.rakeSK} SK`);
  showResults(result);
}

runMatch().catch((err) => {
  console.error("Match failed:", err.message);
});
```

### Vanilla JavaScript (no bundler)

```html
<script type="module">
  import SkillFlow from "./lib/skillflow-sdk.js";

  const params = new URLSearchParams(window.location.search);

  SkillFlow.init("blockade-v1", window.SKILLFLOW_API_KEY, params.get("matchId"))
    .then(() => SkillFlow.matchStart())
    .then(() => playGame())
    .then((winnerId) => SkillFlow.reportWinner(winnerId))
    .then(() => SkillFlow.matchEnd())
    .then((result) => {
      window.location.href = `/results?winner=${result.winner}`;
    })
    .catch((err) => alert(err.message));
</script>
```

---

## API Reference

### `SkillFlow.init(gameId, apiKey, matchId)`

Called once when the game loads.

| Returns | Type | Description |
|---------|------|-------------|
| `player1Id` | `string` | UUID of player 1 |
| `player2Id` | `string` | UUID of player 2 |
| `entrySK` | `number` | Skillies staked per player |
| `potSK` | `number` | Total pot (`entrySK × 2`) |

Throws if `gameId`, `apiKey`, or `matchId` is invalid.

### `SkillFlow.matchStart()`

Called when gameplay is ready to begin (after loading screens).

| Returns | Type | Description |
|---------|------|-------------|
| `started` | `true` | Match is in progress |
| `timeoutSeconds` | `number` | Always `300` — auto-void if `matchEnd` not reached in time |

### `SkillFlow.reportWinner(winnerId)`

Called when your game determines the winner. `winnerId` must be `player1Id` or `player2Id` from `init()`.

| Returns | Type | Description |
|---------|------|-------------|
| `pending` | `true` | Claim recorded; payout pending `matchEnd()` |

Does **not** distribute funds. You must call `matchEnd()` within **30 seconds**.

### `SkillFlow.matchEnd()`

Called immediately after `reportWinner()`. Triggers settlement.

| Returns | Type | Description |
|---------|------|-------------|
| `winner` | `string` | Winner UUID |
| `potSK` | `number` | Total pot before rake |
| `rakeSK` | `number` | Platform rake (12% of pot) |
| `creatorEarnedSK` | `number` | Your share (20% of rake) |

---

## Call order and error messages

The SDK enforces strict ordering. Calling methods out of order throws with a clear message:

| If you call… | Before… | Error |
|--------------|---------|-------|
| `matchStart()` | `init()` | `SkillFlow.matchStart: call init() first.` |
| `reportWinner()` | `init()` | `SkillFlow.reportWinner: call init() first.` |
| `reportWinner()` | `matchStart()` | `SkillFlow.reportWinner: call matchStart() first.` |
| `matchEnd()` | `reportWinner()` | `SkillFlow.matchEnd: call reportWinner() first.` |
| `reportWinner()` twice | — | `SkillFlow.reportWinner: winner already reported for this match.` |
| `matchStart()` twice | — | `SkillFlow.matchStart: match already started.` |

Server-side equivalents: `CALL_INIT_FIRST`, `CALL_MATCH_START_FIRST`, `CALL_REPORT_WINNER_FIRST`, `WINNER_ALREADY_REPORTED`.

---

## Match void scenarios

If a match is voided, **both players are refunded** their entry stake and **the creator earns nothing**.

| Trigger | Timeout | What happens |
|---------|---------|--------------|
| No winner reported after `matchStart()` | **300 seconds** | Match voided, both players refunded |
| No `matchEnd()` after `reportWinner()` | **30 seconds** | Match voided, both players refunded |

Voided matches throw `MATCH_VOIDED` on subsequent SDK calls.

---

## Economics

- **Skillies (SK):** internal currency; **80 SK = $1 USD**
- **Players:** always exactly 2 per match
- **Platform rake:** 12% of the pot
- **Creator share:** 20% of the rake (not 20% of the pot)
- Example: 400 SK entry × 2 = 800 SK pot → 96 SK rake → **19 SK** creator earnings

The SDK never exposes player wallet balances or real-world financial data to your game.

---

## Authentication and signing

Every request is signed with **HMAC-SHA256**. The raw `apiKey` is never sent over the wire.

| Request | Signed message |
|---------|----------------|
| `init`, `start`, `end` | `apiKey + matchId + timestamp` |
| `reportWinner` | `apiKey + matchId + winnerId + timestamp` |

Headers sent on every request:

```
X-SkillFlow-Game-Id: blockade-v1
X-SkillFlow-Match-Id: <uuid>
X-SkillFlow-Timestamp: <unix seconds>
X-SkillFlow-Signature: <hmac hex>
```

---

## Development and testing

Use a `matchId` starting with `test_` in development (e.g. `test_local_001`). The SDK logs:

```
[SkillFlow SDK] Development mode: using test matchId. No real Skillies will move.
```

Test matches return mock data without touching the database.

---

## Security notice

> **Never expose your `apiKey` in production client code.**
>
> The key is used to sign requests. If leaked, an attacker could report false winners on your matches. Store it in an environment variable on your build server or proxy signing through your own backend.

For local development, use `.env.local`:

```
SKILLFLOW_GAME_ID=blockade-v1
SKILLFLOW_API_KEY=sk_test_...
```

---

## Support

Creator SDK access is invite-only. Contact SkillFlow support for dashboard access and production game registration.
