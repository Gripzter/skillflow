/* eslint-disable @next/next/no-img-element */
"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createShuffledDeck,
  type MemoryCard,
  type MemoryMatchPlayer,
  allPairsFound,
  remainingPairs,
} from "@/lib/games/memory-logic";
import { getMemoryMatchBotMove, getMemoryMatchBotDelayMs } from "@/lib/games/bot-engine";

interface MemoryMatchProps {
  player1: { username: string; rating: number };
  player2: { username: string; rating: number };
  onGameEnd: (winner: "player1" | "player2") => void;
  onGameDraw: () => void;
  isPlayer2Bot?: boolean;
}

type LogEntry = {
  id: string;
  player: MemoryMatchPlayer | 0;
  message: string;
};

const GRID_COLS = 6;
const GRID_ROWS = 6;
const CARD_GAP = 8;
const MIN_CARD_SIZE = 50;
const MAX_CARD_SIZE = 90;

export default function MemoryMatch({
  player1,
  player2,
  onGameEnd,
  onGameDraw,
  isPlayer2Bot = true,
}: MemoryMatchProps) {
  const [cards, setCards] = useState<MemoryCard[]>(() => createShuffledDeck());
  const [currentPlayer, setCurrentPlayer] = useState<MemoryMatchPlayer>(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [scores, setScores] = useState<{ 1: number; 2: number }>({ 1: 0, 2: 0 });
  const [moves, setMoves] = useState<LogEntry[]>([]);
  const [turnMessage, setTurnMessage] = useState<string>("YOUR TURN — Find a pair!");
  const [gameOver, setGameOver] = useState(false);
  const [suddenDeath, setSuddenDeath] = useState(false);
  const [streak, setStreak] = useState<{ 1: number; 2: number }>({ 1: 0, 2: 0 });
  const [thinking, setThinking] = useState(false);
  const [cardSize, setCardSize] = useState(60);
  const [isProcessing, setIsProcessing] = useState(false);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const resolvingRef = useRef(false);
  const processingRef = useRef(false);
  const gameEndCalledRef = useRef(false);
  const botMemoryRef = useRef<Record<string, number[]>>({});
  const desktopLogRef = useRef<HTMLDivElement | null>(null);
  const mobileLogRef = useRef<HTMLDivElement | null>(null);
  const desktopAtBottomRef = useRef(true);
  const mobileAtBottomRef = useRef(true);

  const totalPairs = useMemo(() => cards.length / 2, [cards.length]);
  const remaining = useMemo(() => remainingPairs(cards), [cards]);

  const addLog = useCallback((entry: Omit<LogEntry, "id">) => {
    setMoves((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ...entry,
      },
      ...prev,
    ]);
  }, []);

  const updateCardSize = useCallback(() => {
    const el = boardRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (!w || !h) return;
    const totalGapX = CARD_GAP * (GRID_COLS - 1);
    const totalGapY = CARD_GAP * (GRID_ROWS - 1);
    const availableWidth = w - totalGapX - 32;
    const reservedTopBottom = 160;
    const availableHeight = h - totalGapY - reservedTopBottom;
    const maxByWidth = availableWidth / GRID_COLS;
    const maxByHeight = availableHeight / GRID_ROWS;
    const raw = Math.floor(Math.min(maxByWidth, maxByHeight));
    if (!Number.isFinite(raw) || raw <= 0) return;
    const size = Math.max(MIN_CARD_SIZE, Math.min(raw, MAX_CARD_SIZE));
    setCardSize(size);
  }, []);

  useLayoutEffect(() => {
    updateCardSize();
  }, [updateCardSize]);

  // Debug: track turn and processing state
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("MemoryMatch currentPlayer:", currentPlayer);
  }, [currentPlayer]);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("MemoryMatch isProcessing:", isProcessing, "resolvingRef:", resolvingRef.current);
  }, [isProcessing]);

  // Safety net: auto-unlock if processing for too long
  useEffect(() => {
    if (!isProcessing) return;
    const safety = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn("MemoryMatch safety unlock triggered — game was stuck");
      processingRef.current = false;
      resolvingRef.current = false;
      setIsProcessing(false);
    }, 5000);
    return () => clearTimeout(safety);
  }, [isProcessing]);

  useEffect(() => {
    const el = boardRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => updateCardSize());
    ro.observe(el);
    window.addEventListener("resize", updateCardSize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateCardSize);
    };
  }, [updateCardSize]);

  const flipCardAt = useCallback(
    (index: number, player: MemoryMatchPlayer) => {
      if (gameOver || resolvingRef.current || processingRef.current) return;
      const card = cards[index];
      if (!card || card.state !== "hidden") return;
      const nextCards = cards.slice();
      nextCards[index] = { ...card, state: "revealed" };
      setCards(nextCards);
      setSelected((prev) => [...prev, index].slice(-2));
      addLog({
        player,
        message:
          player === 1
            ? `Developer flipped ${card.icon}`
            : `${player2.username} flipped ${card.icon}`,
      });
    },
    [cards, addLog, gameOver, player2.username]
  );

  const resolveSelection = useCallback(
    (indices: number[], player: MemoryMatchPlayer) => {
      if (indices.length !== 2) return;
      if (processingRef.current) return;
      const [a, b] = indices;
      const ca = cards[a];
      const cb = cards[b];
      if (!ca || !cb) return;

      resolvingRef.current = true;
      processingRef.current = true;
      setIsProcessing(true);

      const isMatch = ca.icon === cb.icon;

      if (isMatch) {
        setTimeout(() => {
          setCards((prev) => {
            const next = prev.slice();
            [a, b].forEach((i) => {
              const c = next[i];
              if (!c) return;
              next[i] = {
                ...c,
                state: "matched",
                matchedBy: player,
              };
            });
            return next;
          });
          setScores((prev) => ({ ...prev, [player]: prev[player] + 1 }));
          setStreak((prev) => ({ ...prev, [player]: prev[player] + 1 }));
          addLog({
            player,
            message:
              player === 1
                ? `Developer found a pair! ${ca.icon}${cb.icon}`
                : `${player2.username} found a pair! ${ca.icon}${cb.icon}`,
          });
          setTurnMessage(
            player === 1
              ? "Bonus turn! Keep going."
              : "Opponent gets a bonus turn!"
          );
          setSelected([]);

          setTimeout(() => {
            const nowAllFound = allPairsFound(
              (cardsRef.current ?? []).length ? cardsRef.current : []
            );
            resolvingRef.current = false;
            processingRef.current = false;
            setIsProcessing(false);
            if (nowAllFound) {
              if (gameEndCalledRef.current) return;
              gameEndCalledRef.current = true;
              const p1 = scoresRef.current[1];
              const p2 = scoresRef.current[2];
              if (p1 === p2) {
                setSuddenDeath(true);
                setTurnMessage("TIE! Sudden Death — next pair wins.");
                addLog({
                  player: 0,
                  message: "TIE! Sudden Death — 4 new pairs added.",
                });
                setCards(createShuffledDeck({ pairs: 4 }));
                setScores({ 1: p1, 2: p2 });
                setSelected([]);
                setGameOver(false);
                gameEndCalledRef.current = false;
                return;
              }
              setGameOver(true);
              if (p1 > p2) onGameEnd("player1");
              else onGameEnd("player2");
            } else {
              setCurrentPlayer(player);
              // eslint-disable-next-line no-console
              console.log("Turn staying with:", player);
            }
          }, 400);
        }, 260);
      } else {
        setTimeout(() => {
          setCards((prev) => {
            const next = prev.slice();
            [a, b].forEach((i) => {
              const c = next[i];
              if (!c) return;
              next[i] = { ...c, state: "hidden" };
            });
            return next;
          });
          addLog({
            player,
            message:
              player === 1
                ? `No match — your turn passes.`
                : `No match — your turn next.`,
          });
          setSelected([]);
          setStreak((prev) => ({ ...prev, [player]: 0 }));
          const nextPlayer: MemoryMatchPlayer = player === 1 ? 2 : 1;
          setCurrentPlayer(() => nextPlayer);
          // eslint-disable-next-line no-console
          console.log("Turn passing to:", nextPlayer);
          setTurnMessage(
            nextPlayer === 1
              ? "YOUR TURN — Find a pair!"
              : "Opponent's turn — Watch and memorize!"
          );
          resolvingRef.current = false;
          processingRef.current = false;
          setIsProcessing(false);
          // eslint-disable-next-line no-console
          console.log("ALL FLAGS RESET - player should be able to click now");
        }, 1200);
      }
    },
    [addLog, onGameEnd, player2.username]
  );

  const cardsRef = useRef<MemoryCard[]>(cards);
  const scoresRef = useRef<{ 1: number; 2: number }>(scores);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);
  useEffect(() => {
    scoresRef.current = scores;
  }, [scores]);

  // Auto-scroll logs to latest entry within their own containers (no page scroll)
  // Auto-scroll logs to latest entry when user is already at bottom
  useEffect(() => {
    if (desktopLogRef.current && desktopAtBottomRef.current) {
      const el = desktopLogRef.current;
      el.scrollTop = el.scrollHeight;
    }
    if (mobileLogRef.current && mobileAtBottomRef.current) {
      const el = mobileLogRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [moves.length]);

  useEffect(() => {
    if (selected.length === 2) {
      resolveSelection(selected, currentPlayer);
    }
  }, [selected, currentPlayer, resolveSelection]);

  useEffect(() => {
    if (!isPlayer2Bot || currentPlayer !== 2 || gameOver || isProcessing) {
      return;
    }
    // eslint-disable-next-line no-console
    console.log("BOT TURN STEP: start thinking", { currentPlayer, gameOver, isProcessing });
    setThinking(true);

    const snapshot = cards.map((c, index) => ({
      index,
      icon: c.icon,
      state: c.state,
    }));

    const botDecision = getMemoryMatchBotMove({
      cards: snapshot,
      memory: botMemoryRef.current,
      accuracy: "medium",
    });

    botMemoryRef.current = botDecision.updatedMemory;

    const firstDelay = getMemoryMatchBotDelayMs(botDecision.knowsPair, false);
    const secondDelay = getMemoryMatchBotDelayMs(botDecision.knowsPair, true);

    const t1 = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.log("BOT TURN STEP: flip first card", botDecision.firstIndex);
      flipCardAt(botDecision.firstIndex, 2);
    }, firstDelay);

    const t2 = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.log("BOT TURN STEP: flip second card", botDecision.secondIndex);
      flipCardAt(botDecision.secondIndex, 2);
      setThinking(false);
    }, firstDelay + secondDelay);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [cards, currentPlayer, gameOver, isPlayer2Bot, flipCardAt, isProcessing]);

  const handleCardClick = useCallback(
    (index: number) => {
      // Single source of truth for interactivity on human side:
      // - must be player's turn
      // - game not over
      // - cannot pick more than 2 cards
      if (gameOver || currentPlayer !== 1) {
        return;
      }
      if (selected.length >= 2) {
        return;
      }
      const card = cards[index];
      if (!card || card.state !== "hidden") return;
      flipCardAt(index, 1);
    },
    [cards, currentPlayer, gameOver, flipCardAt, selected.length]
  );

  const formatScoreLabel = (name: string, score: number) => `${name}: ${score}`;

  const activeColor =
    currentPlayer === 1 ? "rgba(0,229,199,0.8)" : "rgba(168, 85, 247, 0.8)";

  return (
      <div className="flex h-full min-h-0 w-full flex-col md:flex-row md:gap-4">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden py-4 md:min-w-0">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Memory Match 🧠</span>
          </div>
          <div className="text-xs text-body-gray">
            {suddenDeath ? "Sudden Death" : `${totalPairs} pairs • ${remaining} remaining`}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2">
          <div
            className={`flex flex-1 items-center gap-2 rounded-lg border px-2 py-1 ${
              currentPlayer === 1 ? "border-teal/60 bg-teal/10" : "border-white/10 bg-transparent"
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal to-emerald-500 text-sm font-bold text-charcoal">
              {player1.username.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-white truncate max-w-[120px]">
                {player1.username}
              </span>
              <span className="text-[11px] text-body-gray">Rating {player1.rating}</span>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm font-semibold text-teal">
                {formatScoreLabel("Pairs", scores[1])}
              </p>
            </div>
          </div>
          <div
            className={`flex flex-1 items-center gap-2 rounded-lg border px-2 py-1 ${
              currentPlayer === 2 ? "border-purple/60 bg-purple/10" : "border-white/10 bg-transparent"
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-bold text-white">
              {player2.username.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-white truncate max-w-[120px]">
                {player2.username}
              </span>
              <span className="text-[11px] text-body-gray">Rating {player2.rating}</span>
            </div>
            <div className="ml-auto flex flex-col items-end gap-0.5">
              <p className="text-sm font-semibold text-purple-300">
                {formatScoreLabel("Pairs", scores[2])}
              </p>
              {isPlayer2Bot && (
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-body-gray">
                  🤖 BOT
                </span>
              )}
              {thinking && (
                <span className="text-[10px] text-body-gray animate-pulse">Thinking...</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#050713]/60">
          <div
            ref={boardRef}
            className="relative flex items-center justify-center p-3"
            style={{
              perspective: "1000px",
              boxShadow: `0 0 0 1px rgba(255,255,255,0.02), 0 0 30px ${activeColor}`,
              borderRadius: 18,
            }}
          >
            <div
              className="absolute inset-0 rounded-[18px] border-[2px]"
              style={{
                borderColor: activeColor,
                opacity: 0.35,
                boxShadow: `0 0 20px ${activeColor}`,
              }}
            />
            <div
              className="relative grid"
              style={{
                gridTemplateColumns: `repeat(${GRID_COLS}, ${cardSize}px)`,
                gridTemplateRows: `repeat(${GRID_ROWS}, ${cardSize}px)`,
                gap: CARD_GAP,
              }}
            >
              {cards.map((card, index) => {
                const isFlipped = card.state !== "hidden";
                const isMatched = card.state === "matched";
                const matchedBy = card.matchedBy;
                const borderColor =
                  isMatched && matchedBy === 1
                    ? "#FF5E00"
                    : isMatched && matchedBy === 2
                      ? "#A855F7"
                      : isFlipped
                        ? "rgba(0, 229, 199, 0.5)"
                        : "rgba(124, 92, 252, 0.3)";

                const background =
                  isMatched
                    ? "rgba(0,229,199,0.15)"
                    : isFlipped
                      ? "#252840"
                      : "radial-gradient(circle at 30% 30%, #1E2030, #050713)";

                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => handleCardClick(index)}
                    disabled={
                      gameOver ||
                      resolvingRef.current ||
                      isProcessing ||
                      card.state !== "hidden" ||
                      currentPlayer !== 1
                    }
                    className="memory-card group relative flex items-center justify-center rounded-[10px] outline-none"
                    style={{
                      width: cardSize,
                      height: cardSize,
                    }}
                  >
                    <div
                      className={`memory-card-inner ${
                        isFlipped ? "memory-card-flipped" : ""
                      }`}
                    >
                      <div
                        className="memory-card-face memory-card-back"
                        style={{
                          borderColor: "rgba(124, 92, 252, 0.3)",
                          background,
                        }}
                      >
                        <span className="text-2xl text-white/60 select-none">?</span>
                      </div>
                      <div
                        className="memory-card-face memory-card-front"
                        style={{
                          borderColor,
                          background,
                          boxShadow: isMatched
                            ? matchedBy === 1
                              ? "0 0 16px rgba(0,229,199,0.6)"
                              : "0 0 16px rgba(168,85,247,0.6)"
                            : "0 4px 10px rgba(0,0,0,0.6)",
                          transform: isMatched ? "scale(0.95)" : undefined,
                        }}
                      >
                        <span
                          className="select-none"
                          style={{ fontSize: `${cardSize * 0.6}px` }}
                        >
                          {card.icon}
                        </span>
                        {isMatched && (
                          <span className="absolute right-1 top-1 text-[14px] text-teal">
                            ✓
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-1 text-center text-sm text-body-gray">
          {turnMessage}
        </div>
      </div>

      {/* Desktop game log: fixed-height live feed beside board */}
      <div className="hidden w-full shrink-0 flex-col rounded-lg border border-white/10 bg-card/80 md:flex md:w-[320px] md:flex-shrink-0 min-h-0 h-full">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-card/90 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">Game Log</h3>
        </div>
        <div
          ref={desktopLogRef}
          className="flex-1 min-h-0 overflow-y-auto p-3"
          onScroll={(e) => {
            const el = e.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
            desktopAtBottomRef.current = atBottom;
          }}
        >
          {moves.length === 0 ? (
            <p className="py-4 text-center text-sm text-body-gray">
              Flip two cards to start!
            </p>
          ) : (
            moves.map((entry) => {
              const isP1 = entry.player === 1;
              const isP2 = entry.player === 2;
              return (
                <div
                  key={entry.id}
                  className="mb-2 flex max-w-[80%] shrink-0"
                  style={{
                    marginLeft: isP1 ? "auto" : 0,
                    marginRight: isP2 ? 0 : isP1 ? 0 : "auto",
                  }}
                >
                  <div
                    className="rounded-xl px-3.5 py-2.5"
                    style={{
                      backgroundColor: isP1
                        ? "rgba(0,229,199,0.25)"
                        : isP2
                          ? "rgba(168,85,247,0.25)"
                          : "rgba(148,163,184,0.16)",
                      borderLeft: isP1
                        ? "3px solid rgba(0,229,199,0.6)"
                        : isP2
                          ? "3px solid rgba(168,85,247,0.7)"
                          : "3px solid rgba(148,163,184,0.6)",
                    }}
                  >
                    <p className="text-xs font-bold text-white">
                      {isP1
                        ? player1.username
                        : isP2
                          ? `${player2.username}${isPlayer2Bot ? " 🤖" : ""}`
                          : "Game"}
                    </p>
                    <p className="mt-0.5 text-xs text-white/90">
                      {entry.message}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Mobile game log: fixed-height live feed below board */}
      <div className="mt-3 w-full shrink-0 rounded-lg border border-white/10 bg-card/80 p-3 md:hidden">
        <div className="border-b border-white/10 pb-2">
          <h3 className="text-sm font-semibold text-white">Game Log</h3>
        </div>
        <div
          ref={mobileLogRef}
          className="mt-2 max-h-[150px] overflow-y-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
            mobileAtBottomRef.current = atBottom;
          }}
        >
          {moves.length === 0 ? (
            <p className="py-2 text-center text-xs text-body-gray">
              Flip two cards to start!
            </p>
          ) : (
            moves.map((entry) => {
              const isP1 = entry.player === 1;
              const isP2 = entry.player === 2;
              return (
                <div
                  key={entry.id}
                  className="mb-2 flex max-w-full shrink-0"
                  style={{
                    marginLeft: isP1 ? "auto" : 0,
                    marginRight: isP2 ? 0 : isP1 ? 0 : "auto",
                  }}
                >
                  <div
                    className="rounded-xl px-3.5 py-2.5"
                    style={{
                      backgroundColor: isP1
                        ? "rgba(0,229,199,0.25)"
                        : isP2
                          ? "rgba(168,85,247,0.25)"
                          : "rgba(148,163,184,0.16)",
                      borderLeft: isP1
                        ? "3px solid rgba(0,229,199,0.6)"
                        : isP2
                          ? "3px solid rgba(168,85,247,0.7)"
                          : "3px solid rgba(148,163,184,0.6)",
                    }}
                  >
                    <p className="text-[11px] font-bold text-white">
                      {isP1
                        ? player1.username
                        : isP2
                          ? `${player2.username}${isPlayer2Bot ? " 🤖" : ""}`
                          : "Game"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/90">
                      {entry.message}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
          .memory-card {
            perspective: 1000px;
            cursor: pointer;
            transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          }
          .memory-card:disabled {
            cursor: default;
          }
          .memory-card:not(:disabled):hover .memory-card-back {
            border-color: rgba(124, 92, 252, 0.8);
            box-shadow: 0 0 12px rgba(124, 92, 252, 0.8);
            transform: scale(1.03);
          }
          .memory-card-inner {
            position: relative;
            width: 100%;
            height: 100%;
            transform-style: preserve-3d;
            transition: transform 400ms cubic-bezier(0.4, 0.2, 0.1, 1);
          }
          .memory-card-flipped {
            transform: rotateY(180deg);
          }
          .memory-card-face {
            position: absolute;
            inset: 0;
            backface-visibility: hidden;
            border-radius: 10px;
            border-width: 2px;
            border-style: solid;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .memory-card-back {
            transform: rotateY(0deg);
          }
          .memory-card-front {
            transform: rotateY(180deg);
          }
        `,
        }}
      />
    </div>
  );
}

