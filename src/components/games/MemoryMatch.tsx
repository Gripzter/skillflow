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
import { getMemoryMatchBotMove, getMemoryMatchBotDelayMs, type BotDifficulty } from "@/lib/games/bot-engine";
import type { GameMultiplayerProps } from "@/components/games/Chess";
import type { MatchUiState } from "@/components/game/matchUi";

interface MemoryMatchProps extends GameMultiplayerProps {
  player1: { username: string; rating: number };
  player2: { username: string; rating: number };
  onGameEnd: (winner: "player1" | "player2") => void;
  onGameDraw: () => void;
  isPlayer2Bot?: boolean;
  botDifficulty?: BotDifficulty;
  /** Real-money vs practice accent on active row (defaults true = practice). */
  isPractice?: boolean;
  /** Match ID used as a seed so both multiplayer clients get the same deck. */
  seed?: string;
}

type LogEntry = {
  id: string;
  player: MemoryMatchPlayer | 0;
  message: string;
};

const GRID_COLS = 6;
const GRID_ROWS = 6;
const CARD_GAP = 8;
const MIN_CARD_SIZE = 36;
const MAX_CARD_SIZE = 90;

export default function MemoryMatch({
  player1,
  player2,
  onGameEnd,
  onGameDraw,
  isPlayer2Bot = true,
  botDifficulty = "gamer",
  isPractice: _isPractice = true,
  seed,
  isMultiplayer = false,
  myRole = "player1",
  sendGameEvent,
  onPlayerAction,
  incomingEvent,
  onEventProcessed,
  onMatchUi,
}: MemoryMatchProps) {
  const [cards, setCards] = useState<MemoryCard[]>(() => createShuffledDeck(undefined, seed));
  const [currentPlayer, setCurrentPlayer] = useState<MemoryMatchPlayer>(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [scores, setScores] = useState<{ 1: number; 2: number }>({ 1: 0, 2: 0 });
  const [moves, setMoves] = useState<LogEntry[]>([]);
  const [turnMessage, setTurnMessage] = useState<string>("YOUR TURN — Find a pair!");
  const [gameOver, setGameOver] = useState(false);
  const [suddenDeath, setSuddenDeath] = useState(false);
  const [streak, setStreak] = useState<{ 1: number; 2: number }>({ 1: 0, 2: 0 });
  const [cardSize, setCardSize] = useState(60);
  const [isProcessing, setIsProcessing] = useState(false);
  const gameStartRef = useRef(Date.now());

  const boardSlotRef = useRef<HTMLDivElement | null>(null);
  const resolvingRef = useRef(false);
  const processingRef = useRef(false);
  const gameEndCalledRef = useRef(false);
  const botMemoryRef = useRef<Record<string, number[]>>({});
  const lastProcessedEventRef = useRef<Record<string, unknown> | null>(null);

  // In multiplayer, "my turn" depends on myRole; in single-player the human is always player 1.
  const isMyTurn = !isMultiplayer
    ? currentPlayer === 1
    : (currentPlayer === 1 && myRole === "player1") || (currentPlayer === 2 && myRole === "player2");

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
    const parent = boardSlotRef.current;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (!w || !h) return;
    const totalGapX = CARD_GAP * (GRID_COLS - 1);
    const totalGapY = CARD_GAP * (GRID_ROWS - 1);
    const pad = 20;
    const availableWidth = w - totalGapX - pad;
    const availableHeight = h - totalGapY - pad;
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
    const ro = new ResizeObserver(() => updateCardSize());
    if (boardSlotRef.current) ro.observe(boardSlotRef.current);
    updateCardSize();
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
            ? `${player1.username} flipped ${card.icon}`
            : `${player2.username} flipped ${card.icon}`,
      });
    },
    [cards, addLog, gameOver, player1.username, player2.username]
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

  useEffect(() => {
    if (selected.length === 2) {
      resolveSelection(selected, currentPlayer);
    }
  }, [selected, currentPlayer, resolveSelection]);

  // Handle incoming multiplayer events from the opponent.
  useEffect(() => {
    if (!incomingEvent || !onEventProcessed) return;
    if (incomingEvent === lastProcessedEventRef.current) return;
    lastProcessedEventRef.current = incomingEvent;

    const type = incomingEvent.type as string | undefined;
    if (type === "memory_flip") {
      const cardIndex = incomingEvent.cardIndex as number | undefined;
      if (typeof cardIndex === "number" && cardIndex >= 0) {
        // Apply the opponent's flip locally so both players see it.
        const opponentRole: MemoryMatchPlayer = myRole === "player1" ? 2 : 1;
        flipCardAt(cardIndex, opponentRole);
      }
    }
    onEventProcessed();
  }, [incomingEvent, onEventProcessed, myRole, flipCardAt]);

  useEffect(() => {
    if (!isPlayer2Bot || currentPlayer !== 2 || gameOver || isProcessing) {
      return;
    }
    const snapshot = cards.map((c, index) => ({
      index,
      icon: c.icon,
      state: c.state,
    }));

    const botDecision = getMemoryMatchBotMove({
      cards: snapshot,
      memory: botMemoryRef.current,
      botDifficulty,
    });

    botMemoryRef.current = botDecision.updatedMemory;

    const firstDelay = getMemoryMatchBotDelayMs(botDecision.knowsPair, false);
    const secondDelay = getMemoryMatchBotDelayMs(botDecision.knowsPair, true);

    const t1 = setTimeout(() => {
      flipCardAt(botDecision.firstIndex, 2);
    }, firstDelay);

    const t2 = setTimeout(() => {
      flipCardAt(botDecision.secondIndex, 2);
    }, firstDelay + secondDelay);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [cards, currentPlayer, gameOver, isPlayer2Bot, botDifficulty, flipCardAt, isProcessing]);

  const handleCardClick = useCallback(
    (index: number) => {
      // Must be this player's turn, game not over, and fewer than 2 cards selected.
      if (gameOver || !isMyTurn) return;
      if (selected.length >= 2) return;
      const card = cards[index];
      if (!card || card.state !== "hidden") return;
      onPlayerAction?.();
      // In multiplayer, the local human may be player 1 or player 2.
      const localPlayer: MemoryMatchPlayer = isMultiplayer && myRole === "player2" ? 2 : 1;
      flipCardAt(index, localPlayer);
      if (isMultiplayer && sendGameEvent) {
        sendGameEvent({ type: "memory_flip", cardIndex: index }).catch(() => {});
      }
    },
    [cards, isMyTurn, gameOver, flipCardAt, selected.length, isMultiplayer, myRole, sendGameEvent, onPlayerAction]
  );

  const activeColor =
    currentPlayer === 1 ? "rgba(0,229,199,0.8)" : "rgba(168, 85, 247, 0.8)";

  useEffect(() => {
    if (!onMatchUi) return;
    const systemLogEntries: MatchUiState["systemLogEntries"] = [
      {
        id: "game-start",
        text: `🧠 Memory Match — ${player1.username} vs ${player2.username}${isPlayer2Bot ? " 🤖" : ""}`,
        timestamp: gameStartRef.current,
      },
      ...[...moves]
        .reverse()
        .map((entry) => {
          const ts = parseInt(entry.id.split("-")[0], 10) || Date.now();
          return { id: entry.id, text: entry.message, timestamp: ts };
        }),
    ];
    onMatchUi({
      scores: { player1: scores[1], player2: scores[2] },
      scoreLabel: "Pairs",
      currentTurn: currentPlayer === 1 ? "player1" : "player2",
      requiresAction: !gameOver && !isProcessing && !resolvingRef.current,
      turnText: turnMessage,
      systemLogEntries,
    });
  }, [
    onMatchUi,
    scores,
    currentPlayer,
    turnMessage,
    moves,
    player1.username,
    player2.username,
    isPlayer2Bot,
  ]);

  return (
    <div className="flex h-full max-h-full min-h-0 w-full flex-col items-center justify-center overflow-hidden">
      <div className="mb-1.5 w-full shrink-0 px-1 text-center text-[10px] text-body-gray">
        {suddenDeath ? "Sudden Death" : `${totalPairs} pairs • ${remaining} left`}
      </div>
          <div
            ref={boardSlotRef}
            className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#050713]/60"
          >
            <div
              className="relative flex max-h-full max-w-full items-center justify-center p-2"
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
                      !isMyTurn
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

