"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Matter from "matter-js";
import {
  getTableSize,
  getPlayableSize,
  getPocketPositions,
  getCueBallPosition,
  getRackPositionsOrdered,
  getBallRadius,
  getHeadStringX,
  PHYSICS,
  RAIL_WIDTH,
  CUSHION_INSET,
  BALL_COLORS,
  rayCircleIntersect,
  raySegmentIntersect,
  type Pocket,
} from "@/lib/games/pool-physics";
import {
  drawTable,
  drawPockets,
  drawRailDiamonds,
  isTableImageReady,
  drawBall,
  drawAimLine,
  drawGhostBall,
  drawCueStick,
  drawPowerBar,
  drawCallPocketOverlay,
  drawFoulBanner,
  drawBallAssignment,
  type AimState,
  type WorldToCanvas,
} from "@/lib/games/pool-renderer";
import {
  createInitialState,
  getBallGroup,
  getOpponent,
  isPlayerBall,
  assignGroupAfterBreak,
  hasClearedGroup,
  type GameState,
  type PlayerId,
} from "@/lib/games/pool-rules";
import { getPoolBotShot, getPoolBotDelayMs } from "@/lib/games/bot-engine";

const MIN_POWER = 0.05;
const MAX_POWER = 1;
const VELOCITY_THRESHOLD = 0.05;
const TURN_DELAY_MS = 500;
const MAX_FORCE = 0.0018 * 120;
const INSET = RAIL_WIDTH + CUSHION_INSET;

interface EightBallPoolProps {
  player1: { username: string; rating: number };
  player2: { username: string; rating: number };
  onGameEnd: (winner: "player1" | "player2") => void;
  isPlayer2Bot?: boolean;
}

export default function EightBallPool({ player1, player2, onGameEnd, isPlayer2Bot = true }: EightBallPoolProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const ballsRef = useRef<Map<number, Matter.Body>>(new Map());
  const cueBallRef = useRef<Matter.Body | null>(null);
  const wallsRef = useRef<Matter.Body[]>([]);
  const pocketsRef = useRef<Pocket[]>([]);
  const playSizeRef = useRef({ width: 0, height: 0 });
  const ballRadiusRef = useRef(12);
  const tableSizeRef = useRef({ width: 800, height: 400 });

  const [tableSize, setTableSize] = useState({ width: 800, height: 400 });
  const [gameState, setGameState] = useState<GameState>(createInitialState());
  const [player1Potted, setPlayer1Potted] = useState<number[]>([]);
  const [player2Potted, setPlayer2Potted] = useState<number[]>([]);
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number } | null>(null);
  const [powerMode, setPowerMode] = useState(false);
  const [power, setPower] = useState(0);
  const [placingCue, setPlacingCue] = useState(false);
  const [previewCuePos, setPreviewCuePos] = useState<{ x: number; y: number } | null>(null);
  const [placeValid, setPlaceValid] = useState(true);
  const [callPocketPhase, setCallPocketPhase] = useState(false);
  const [calledPocketId, setCalledPocketId] = useState<number | null>(null);
  const [foulMessage, setFoulMessage] = useState<string | null>(null);
  const [foulReason, setFoulReason] = useState<string>("");
  const [foulAlpha, setFoulAlpha] = useState(0);
  const [assignmentNotice, setAssignmentNotice] = useState<"solid" | "stripe" | null>(null);
  const [assignmentAlpha, setAssignmentAlpha] = useState(0);
  const [ballsMoving, setBallsMoving] = useState(false);
  const [turnReady, setTurnReady] = useState(true);
  const [botThinking, setBotThinking] = useState(false);

  const onGameEndRef = useRef(onGameEnd);
  onGameEndRef.current = onGameEnd;
  const pottedThisShotRef = useRef<{ ballNum: number; turn: PlayerId }[]>([]);
  const shotTurnRef = useRef<PlayerId>("player1");
  const gameStateRef = useRef<GameState>(gameState);
  const turnDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorWorldRef = useRef<{ x: number; y: number } | null>(null);
  const powerModeRef = useRef(false);
  const powerRef = useRef(0);
  const placingCueRef = useRef(false);
  const previewCuePosRef = useRef<{ x: number; y: number } | null>(null);
  const placeValidRef = useRef(true);
  const callPocketPhaseRef = useRef(false);
  const calledPocketIdRef = useRef<number | null>(null);
  const foulAlphaRef = useRef(0);
  const foulReasonRef = useRef("");
  const assignmentNoticeRef = useRef<"solid" | "stripe" | null>(null);
  const assignmentAlphaRef = useRef(0);
  gameStateRef.current = gameState;
  cursorWorldRef.current = cursorWorld;
  powerModeRef.current = powerMode;
  powerRef.current = power;
  placingCueRef.current = placingCue;
  previewCuePosRef.current = previewCuePos;
  placeValidRef.current = placeValid;
  callPocketPhaseRef.current = callPocketPhase;
  calledPocketIdRef.current = calledPocketId;
  foulAlphaRef.current = foulAlpha;
  foulReasonRef.current = foulReason;
  assignmentNoticeRef.current = assignmentNotice;
  assignmentAlphaRef.current = assignmentAlpha;

  const playWidth = tableSize.width - 2 * INSET;
  const playHeight = tableSize.height - 2 * INSET;
  const ballRadius = getBallRadius(playWidth);
  ballRadiusRef.current = ballRadius;
  tableSizeRef.current = tableSize;

  const worldToCanvas = useCallback<WorldToCanvas>(
    (wx, wy) => ({
      x: INSET + wx,
      y: INSET + wy,
    }),
    []
  );

  const canvasToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx = (clientX - rect.left) * scaleX;
    const cy = (clientY - rect.top) * scaleY;
    return {
      x: Math.max(0, Math.min(playWidth, cx - INSET)),
      y: Math.max(0, Math.min(playHeight, cy - INSET)),
    };
  }, [playWidth, playHeight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 800;
      const size = getTableSize(w);
      setTableSize(size);
    });
    ro.observe(container);
    const w = container.getBoundingClientRect().width;
    setTableSize(getTableSize(w));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ballsMap = ballsRef.current;
    if (!canvas) return;

    const playSize = getPlayableSize(tableSize.width, tableSize.height);
    playSizeRef.current = playSize;
    const br = getBallRadius(playSize.width);
    const pockets = getPocketPositions(playSize.width, playSize.height, br);
    pocketsRef.current = pockets;

    const engine = Matter.Engine.create({
      gravity: PHYSICS.gravity,
      timing: { timeScale: 1 },
    });
    engineRef.current = engine;
    const { world } = engine;

    const wallOptions = {
      isStatic: true,
      restitution: PHYSICS.cushionRestitution,
      friction: PHYSICS.cushionFriction,
    };
    const w = playSize.width + 2 * CUSHION_INSET;
    const h = playSize.height + 2 * CUSHION_INSET;
    const walls = [
      Matter.Bodies.rectangle(CUSHION_INSET / 2, h / 2, CUSHION_INSET, h + 4, wallOptions),
      Matter.Bodies.rectangle(w - CUSHION_INSET / 2, h / 2, CUSHION_INSET, h + 4, wallOptions),
      Matter.Bodies.rectangle(w / 2, CUSHION_INSET / 2, w + 4, CUSHION_INSET, wallOptions),
      Matter.Bodies.rectangle(w / 2, h - CUSHION_INSET / 2, w + 4, CUSHION_INSET, wallOptions),
    ];
    walls.forEach((b) => Matter.World.add(world, b));
    wallsRef.current = walls;

    const ballOptions = {
      restitution: PHYSICS.ballRestitution,
      friction: PHYSICS.ballFriction,
      frictionAir: PHYSICS.ballFrictionAir,
      frictionStatic: PHYSICS.frictionStatic,
      density: PHYSICS.ballDensity,
      slop: PHYSICS.slop,
    };

    const cuePos = getCueBallPosition(playSize.width, playSize.height);
    const cueBall = Matter.Bodies.circle(
      cuePos.x + CUSHION_INSET,
      cuePos.y + CUSHION_INSET,
      br,
      { ...ballOptions, label: "ball-0" }
    );
    Matter.World.add(world, cueBall);
    cueBallRef.current = cueBall;
    ballsMap.set(0, cueBall);

    const rack = getRackPositionsOrdered(playSize.width, playSize.height, br);
    rack.forEach(({ x, y, ballNumber }) => {
      const body = Matter.Bodies.circle(
        x + CUSHION_INSET,
        y + CUSHION_INSET,
        br,
        { ...ballOptions, label: `ball-${ballNumber}` }
      );
      Matter.World.add(world, body);
      ballsMap.set(ballNumber, body);
    });

    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);

    let rafId: number;
    function render() {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const play = playSizeRef.current;
      const pockets = pocketsRef.current;
      const scale = 1;
      const cursorWorld = cursorWorldRef.current;
      const powerMode = powerModeRef.current;
      const power = powerRef.current;
      const placingCue = placingCueRef.current;
      const previewCuePos = previewCuePosRef.current;
      const placeValid = placeValidRef.current;
      const callPocketPhase = callPocketPhaseRef.current;
      const calledPocketId = calledPocketIdRef.current;
      const foulAlpha = foulAlphaRef.current;
      const foulReason = foulReasonRef.current;
      const assignmentNotice = assignmentNoticeRef.current;
      const assignmentAlpha = assignmentAlphaRef.current;

      drawTable(ctx, tableSize.width, tableSize.height, play.width, play.height, worldToCanvas, scale);
      if (!isTableImageReady()) {
        drawPockets(ctx, pockets, worldToCanvas, scale, calledPocketId, callPocketPhase);
        drawRailDiamonds(ctx, play.width, play.height, worldToCanvas, scale);
      } else if (callPocketPhase || calledPocketId != null) {
        drawPockets(ctx, pockets, worldToCanvas, scale, calledPocketId, callPocketPhase);
      }

      const anyMoving = Array.from(ballsRef.current.values()).some((b) => {
        const v = b.velocity;
        return Math.hypot(v.x, v.y) > VELOCITY_THRESHOLD;
      });
      setBallsMoving(anyMoving);

      ballsRef.current.forEach((body, ballNum) => {
        const pos = body.position;
        const px = pos.x - CUSHION_INSET;
        const py = pos.y - CUSHION_INSET;
        const v = body.velocity;
        if (Math.hypot(v.x, v.y) < PHYSICS.minVelocity && Math.hypot(v.x, v.y) > 0) {
          Matter.Body.setVelocity(body, { x: 0, y: 0 });
        }
        drawBall(ctx, ballNum, px, py, ballRadiusRef.current, worldToCanvas, scale, false);
      });

      if (placingCue && previewCuePos) {
        drawBall(
          ctx,
          0,
          previewCuePos.x,
          previewCuePos.y,
          ballRadiusRef.current,
          worldToCanvas,
          scale,
          true
        );
        if (!placeValid) {
          ctx.save();
          const { x, y } = worldToCanvas(previewCuePos.x, previewCuePos.y);
          ctx.strokeStyle = "rgba(239,68,68,0.8)";
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.arc(x, y, ballRadiusRef.current * scale, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      const cue = cueBallRef.current;
      const canAim =
        !ballsMoving &&
        turnReady &&
        cue &&
        !placingCue &&
        !callPocketPhase &&
        cursorWorld &&
        ballsRef.current.has(0);
      if (canAim) {
        const cpos = cue.position;
        const cx = cpos.x - CUSHION_INSET;
        const cy = cpos.y - CUSHION_INSET;
        const dx = cursorWorld.x - cx;
        const dy = cursorWorld.y - cy;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const rayLen = Math.max(play.width, play.height) * 2;
        type BallHit = { t: number; x: number; y: number; isBall: true; targetDx: number; targetDy: number };
        type CushionHit = { t: number; x: number; y: number; isBall: false; bounce: { startX: number; startY: number; endX: number; endY: number } };
        let firstHit: BallHit | CushionHit | null = null;
        ballsRef.current.forEach((body, num) => {
          if (num === 0) return;
          const pos = body.position;
          const bx = pos.x - CUSHION_INSET;
          const by = pos.y - CUSHION_INSET;
          const t = rayCircleIntersect(cx, cy, ux * rayLen, uy * rayLen, bx, by, ballRadiusRef.current);
          if (t !== null && t >= 0 && (firstHit === null || t < firstHit.t)) {
            firstHit = {
              t,
              x: cx + ux * rayLen * t,
              y: cy + uy * rayLen * t,
              isBall: true,
              targetDx: ux,
              targetDy: uy,
            };
          }
        });
        const segs: [number, number, number, number][] = [
          [0, 0, play.width, 0],
          [play.width, 0, play.width, play.height],
          [play.width, play.height, 0, play.height],
          [0, play.height, 0, 0],
        ];
        segs.forEach(([x1, y1, x2, y2]) => {
          const t = raySegmentIntersect(cx, cy, ux * rayLen, uy * rayLen, x1, y1, x2, y2);
          if (t !== null && t >= 0 && (firstHit === null || t < firstHit.t)) {
            const hitX = cx + ux * rayLen * t;
            const hitY = cy + uy * rayLen * t;
            let nx = 0,
              ny = 0;
            if (x1 === x2) {
              nx = x1 === 0 ? 1 : -1;
            } else {
              ny = y1 === 0 ? 1 : -1;
            }
            const dot = ux * nx + uy * ny;
            const rx = ux - 2 * dot * nx;
            const ry = uy - 2 * dot * ny;
            firstHit = {
              t,
              x: hitX,
              y: hitY,
              isBall: false,
              bounce: {
                startX: hitX,
                startY: hitY,
                endX: hitX + rx * 200,
                endY: hitY + ry * 200,
              },
            };
          }
        });
        const aimState: AimState = {
          cueX: cx,
          cueY: cy,
          aimDirX: dx,
          aimDirY: dy,
          power: powerMode ? power : 0,
        };
        const hitBall: BallHit | null = firstHit !== null && (firstHit as BallHit | CushionHit).isBall ? (firstHit as BallHit) : null;
        const hitCushion: CushionHit | null = firstHit !== null && !(firstHit as BallHit | CushionHit).isBall ? (firstHit as CushionHit) : null;
        if (hitBall) {
          aimState.firstHit = { x: hitBall.x, y: hitBall.y, isBall: true };
          aimState.targetLine = {
            x: hitBall.x,
            y: hitBall.y,
            dx: hitBall.targetDx! * 80,
            dy: hitBall.targetDy! * 80,
          };
          const ghostX = hitBall.x - ux * ballRadiusRef.current * 2;
          const ghostY = hitBall.y - uy * ballRadiusRef.current * 2;
          drawGhostBall(ctx, ghostX, ghostY, ballRadiusRef.current, worldToCanvas, scale);
        } else if (hitCushion) {
          aimState.firstHit = { x: hitCushion.x, y: hitCushion.y, isBall: false };
          aimState.cushionBounce = hitCushion.bounce;
        }
        drawAimLine(ctx, aimState, worldToCanvas, scale);
        if (powerMode && power >= MIN_POWER) {
          drawCueStick(ctx, cx, cy, dx, dy, power, tableSize.width, worldToCanvas, scale);
        } else if (!powerMode && cursorWorld) {
          drawCueStick(ctx, cx, cy, dx, dy, 0, tableSize.width, worldToCanvas, scale);
        }
      }

      const powerBarW = 20;
      const powerBarH = tableSize.height;
      const isMobile = tableSize.width < 500;
      if (powerMode && (power >= MIN_POWER || power > 0)) {
        if (isMobile) {
          drawPowerBar(ctx, power, (tableSize.width - 120) / 2, tableSize.height - 32, 120, 20, false);
        } else {
          drawPowerBar(ctx, power, 8, 0, powerBarW, powerBarH, true);
        }
      }

      if (callPocketPhase) {
        drawCallPocketOverlay(ctx, tableSize.width, tableSize.height, scale);
      }
      if (foulAlpha > 0) {
        drawFoulBanner(ctx, foulReason || "Foul", tableSize.width, tableSize.height, foulAlpha);
      }
      if (assignmentAlpha > 0 && assignmentNotice) {
        drawBallAssignment(ctx, assignmentNotice, tableSize.width, tableSize.height, assignmentAlpha);
      }

      rafId = requestAnimationFrame(render);
    }
    render();

    return () => {
      cancelAnimationFrame(rafId);
      Matter.Runner.stop(runner);
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
      engineRef.current = null;
      ballsMap.clear();
      cueBallRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs used for aim/power; must not recreate engine on state change
  }, [tableSize, worldToCanvas]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const interval = setInterval(() => {
      const pockets = pocketsRef.current;
      const br = ballRadiusRef.current;
      const toRemove: { body: Matter.Body; ballNum: number; pocketIndex: number }[] = [];
      ballsRef.current.forEach((body, ballNum) => {
        const pos = body.position;
        const px = pos.x - CUSHION_INSET;
        const py = pos.y - CUSHION_INSET;
        for (let i = 0; i < pockets.length; i++) {
          const p = pockets[i];
          if (Math.hypot(px - p.x, py - p.y) < p.radius) {
            toRemove.push({ body, ballNum, pocketIndex: i });
            break;
          }
        }
      });
      toRemove.forEach(({ body, ballNum, pocketIndex }) => {
        Matter.World.remove(engine.world, body);
        ballsRef.current.delete(ballNum);
        const turn = shotTurnRef.current;
        if (ballNum === 0) {
          setGameState((s) => ({ ...s, ballInHand: getOpponent(s.currentTurn), currentTurn: getOpponent(s.currentTurn) }));
          setFoulMessage("Scratch");
          setFoulReason("Cue ball potted");
          setFoulAlpha(1);
          setTimeout(() => {
            const id = setInterval(() => {
              setFoulAlpha((a) => {
                if (a <= 0) {
                  clearInterval(id);
                  setFoulMessage(null);
                  setFoulReason("");
                  return 0;
                }
                return Math.max(0, a - 0.05);
              });
            }, 50);
          }, 2000);
          pottedThisShotRef.current = [];
        } else {
          pottedThisShotRef.current.push({ ballNum, turn });
          setGameState((s) => {
            const next = { ...s };
            if (s.breaking && s.player1Group === null) {
              const group = getBallGroup(ballNum);
              if (group !== "eight") {
                const assigned = assignGroupAfterBreak(s, group);
                const isP1 = turn === "player1";
                setAssignmentNotice(assigned.player1Group === "solid" ? "solid" : "stripe");
                setAssignmentAlpha(1);
                setTimeout(() => {
                  const fade = setInterval(() => {
                    setAssignmentAlpha((a) => {
                      if (a <= 0) {
                        clearInterval(fade);
                        setAssignmentNotice(null);
                        return 0;
                      }
                      return a - 0.03;
                    });
                  }, 40);
                }, 3000);
                return assigned;
              }
            }
            const isP1 = turn === "player1";
            if (ballNum === 8) {
              if (s.shootingForEight && s.calledPocketId !== null) {
                onGameEndRef.current(pocketIndex === s.calledPocketId ? (isP1 ? "player1" : "player2") : isP1 ? "player2" : "player1");
              } else {
                onGameEndRef.current(isP1 ? "player2" : "player1");
              }
              return next;
            }
            if (isPlayerBall(s, turn, ballNum)) {
              if (isP1) setPlayer1Potted((prev) => [...prev, ballNum]);
              else setPlayer2Potted((prev) => [...prev, ballNum]);
            }
            return next;
          });
        }
      });
    }, 50);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!ballsMoving && gameState.ballInHand) setPlacingCue(true);
  }, [ballsMoving, gameState.ballInHand]);

  const prevBallsMovingRef = useRef(true);
  useEffect(() => {
    if (prevBallsMovingRef.current && !ballsMoving) {
      if (turnDelayRef.current) clearTimeout(turnDelayRef.current);
      turnDelayRef.current = setTimeout(() => {
        setTurnReady(true);
        const state = gameStateRef.current;
        if (!state.ballInHand) {
          const potted = pottedThisShotRef.current;
          const shooter = shotTurnRef.current;
          const pottedOwn = potted.some(
            ({ ballNum, turn }) => turn === shooter && ballNum !== 8 && isPlayerBall(state, shooter, ballNum)
          );
          if (!pottedOwn) {
            setGameState((s) => ({ ...s, currentTurn: getOpponent(s.currentTurn) }));
          }
          pottedThisShotRef.current = [];
        }
        const cur = gameStateRef.current.currentTurn;
        const p1Cleared = state.player1Group !== null && hasClearedGroup(player1Potted);
        const p2Cleared = state.player2Group !== null && hasClearedGroup(player2Potted);
        if ((cur === "player1" && p1Cleared) || (cur === "player2" && p2Cleared)) {
          setGameState((s) => ({ ...s, shootingForEight: true }));
          if (state.calledPocketId === null) setCallPocketPhase(true);
        }
      }, TURN_DELAY_MS);
    }
    if (ballsMoving) setTurnReady(false);
    prevBallsMovingRef.current = ballsMoving;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run only on ballsMoving transition
  }, [ballsMoving, player1Potted, player2Potted]);

  useEffect(() => {
    if (
      !isPlayer2Bot ||
      gameState.currentTurn !== "player2" ||
      !turnReady ||
      ballsMoving ||
      placingCue ||
      callPocketPhase ||
      gameState.ballInHand ||
      botThinking
    )
      return;
    setBotThinking(true);
    const delay = getPoolBotDelayMs();
    const t = setTimeout(() => {
      const cue = cueBallRef.current;
      const play = playSizeRef.current;
      const balls = ballsRef.current;
      if (!cue || !play || !balls.has(0)) {
        setBotThinking(false);
        return;
      }
      const cueX = cue.position.x - CUSHION_INSET;
      const cueY = cue.position.y - CUSHION_INSET;
      const ballMap = new Map<number, { x: number; y: number }>();
      balls.forEach((body, num) => {
        if (num === 0) return;
        const pos = body.position;
        ballMap.set(num, { x: pos.x - CUSHION_INSET, y: pos.y - CUSHION_INSET });
      });
      const shot = getPoolBotShot({
        cueX,
        cueY,
        balls: ballMap,
        player2Group: gameStateRef.current.player2Group,
        playWidth: play.width,
        playHeight: play.height,
      });
      if (shot) {
        shotTurnRef.current = "player2";
        pottedThisShotRef.current = [];
        setTurnReady(false);
        const dx = shot.targetX - cueX;
        const dy = shot.targetY - cueY;
        const len = Math.hypot(dx, dy) || 1;
        const forceMag = MAX_FORCE * Math.max(MIN_POWER, Math.min(MAX_POWER, shot.power));
        const vx = (dx / len) * forceMag;
        const vy = (dy / len) * forceMag;
        Matter.Body.applyForce(cue, cue.position, { x: vx, y: vy });
      }
      setBotThinking(false);
    }, delay);
    return () => clearTimeout(t);
  }, [
    isPlayer2Bot,
    gameState.currentTurn,
    gameState.ballInHand,
    turnReady,
    ballsMoving,
    placingCue,
    callPocketPhase,
    botThinking,
  ]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const world = canvasToWorld(e.clientX, e.clientY);
      if (placingCue && gameState.ballInHand) {
        if (!placeValid) return;
        const engine = engineRef.current;
        const play = playSizeRef.current;
        const headX = getHeadStringX(play.width);
        const isBreak = gameState.breaking;
        let wx = world.x;
        let wy = world.y;
        if (isBreak && gameState.ballInHand) {
          wx = Math.min(headX - ballRadiusRef.current - 2, wx);
        }
        wx = Math.max(ballRadiusRef.current, Math.min(play.width - ballRadiusRef.current, wx));
        wy = Math.max(ballRadiusRef.current, Math.min(play.height - ballRadiusRef.current, wy));
        if (engine) {
          const newCue = Matter.Bodies.circle(wx + CUSHION_INSET, wy + CUSHION_INSET, ballRadiusRef.current, {
            restitution: PHYSICS.ballRestitution,
            friction: PHYSICS.ballFriction,
            frictionAir: PHYSICS.ballFrictionAir,
            frictionStatic: PHYSICS.frictionStatic,
            density: PHYSICS.ballDensity,
            slop: PHYSICS.slop,
            label: "ball-0",
          });
          Matter.World.add(engine.world, newCue);
          cueBallRef.current = newCue;
          ballsRef.current.set(0, newCue);
          setGameState((s) => ({ ...s, ballInHand: null }));
          setPlacingCue(false);
        }
        return;
      }
      if (callPocketPhase) {
        const pockets = pocketsRef.current;
        for (let i = 0; i < pockets.length; i++) {
          const p = pockets[i];
          if (Math.hypot(world.x - p.x, world.y - p.y) < p.radius * 1.5) {
            setCalledPocketId(i);
            setGameState((s) => ({ ...s, calledPocketId: i }));
            setCallPocketPhase(false);
            return;
          }
        }
        return;
      }
      if (ballsMoving || !turnReady || !cueBallRef.current || !ballsRef.current.has(0)) return;
      shotTurnRef.current = gameState.currentTurn;
      pottedThisShotRef.current = [];
      setPowerMode(true);
      setPower(MIN_POWER);
    },
    [placingCue, placeValid, gameState, callPocketPhase, ballsMoving, turnReady, canvasToWorld]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const world = canvasToWorld(e.clientX, e.clientY);
      setCursorWorld(world);
      if (placingCue && gameState.ballInHand) {
        setPreviewCuePos(world);
        const play = playSizeRef.current;
        const headX = getHeadStringX(play.width);
        const isBreak = gameState.breaking;
        let valid = true;
        if (isBreak) {
          if (world.x > headX - ballRadiusRef.current) valid = false;
        }
        ballsRef.current.forEach((body, num) => {
          if (num === 0) return;
          const pos = body.position;
          const dx = (pos.x - CUSHION_INSET) - world.x;
          const dy = (pos.y - CUSHION_INSET) - world.y;
          if (Math.hypot(dx, dy) < ballRadiusRef.current * 2.1) valid = false;
        });
        setPlaceValid(valid);
        return;
      }
      if (powerMode && cueBallRef.current) {
        const cpos = cueBallRef.current.position;
        const cx = cpos.x - CUSHION_INSET;
        const cy = cpos.y - CUSHION_INSET;
        const dx = cx - world.x;
        const dy = cy - world.y;
        const dist = Math.hypot(dx, dy);
        const maxDist = Math.min(playWidth, playHeight) * 0.4;
        const ratio = Math.min(1, dist / maxDist);
        const p = MIN_POWER + ratio * (MAX_POWER - MIN_POWER);
        setPower(p);
      }
    },
    [placingCue, gameState, powerMode, playWidth, playHeight, canvasToWorld]
  );

  const handlePointerUp = useCallback(() => {
    if (placingCue) return;
    if (!powerMode || !cueBallRef.current || ballsMoving) return;
    const cue = cueBallRef.current;
    const cpos = cue.position;
    const cx = cpos.x - CUSHION_INSET;
    const cy = cpos.y - CUSHION_INSET;
    const cw = cursorWorld;
    if (!cw) {
      setPowerMode(false);
      setPower(0);
      return;
    }
    const dx = cx - cw.x;
    const dy = cy - cw.y;
    const len = Math.hypot(dx, dy) || 1;
    const forceMag = MAX_FORCE * Math.max(MIN_POWER, Math.min(MAX_POWER, power));
    const vx = (dx / len) * forceMag;
    const vy = (dy / len) * forceMag;
    Matter.Body.applyForce(cue, cpos, { x: vx, y: vy });
    setPowerMode(false);
    setPower(0);
  }, [powerMode, power, ballsMoving, cursorWorld, placingCue]);

  const currentTurn = gameState.currentTurn;
  const p1Remaining = 7 - player1Potted.length;
  const p2Remaining = 7 - player2Potted.length;
  const p1Label =
    gameState.player1Group === "solid" ? "Solids" : gameState.player1Group === "stripe" ? "Stripes" : "—";
  const p2Label =
    gameState.player2Group === "solid" ? "Solids" : gameState.player2Group === "stripe" ? "Stripes" : "—";

  return (
    <div ref={containerRef} className="flex w-full flex-col items-center overflow-x-auto">
      <div className="flex w-full items-center justify-between gap-2 px-2 py-2">
        <div
          className={`flex flex-col items-start gap-1 rounded-lg px-3 py-2 ${
            currentTurn === "player1" ? "ring-2 ring-teal bg-teal/10" : "bg-white/5"
          }`}
        >
          <span className="text-sm font-medium text-white">{player1.username}</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-body-gray">{p1Label}</span>
            <span className="text-xs text-body-gray">({p1Remaining} left)</span>
          </div>
          <div className="flex gap-0.5 flex-wrap max-w-[120px]">
            {player1Potted.map((n) => (
              <span
                key={n}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: BALL_COLORS[n]?.fill ?? "#666" }}
              >
                {n}
              </span>
            ))}
          </div>
        </div>
        <div
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            currentTurn === "player1" ? "bg-teal text-charcoal" : "bg-purple/80 text-white"
          }`}
        >
          {currentTurn === "player1" ? "Player 1's Turn" : "Player 2's Turn"}
        </div>
        <div
          className={`flex flex-col items-end gap-1 rounded-lg px-3 py-2 ${
            currentTurn === "player2" ? "ring-2 ring-purple bg-purple/10" : "bg-white/5"
          }`}
        >
          <span className="text-sm font-medium text-white">
            {player2.username}
            {isPlayer2Bot && (
              <span className="ml-1.5 inline-flex items-center rounded bg-white/10 px-1.5 py-0.5 text-xs font-medium text-body-gray">
                🤖 BOT
              </span>
            )}
            {botThinking && <span className="ml-1 inline-flex animate-pulse text-body-gray">...</span>}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-body-gray">{p2Label}</span>
            <span className="text-xs text-body-gray">({p2Remaining} left)</span>
          </div>
          <div className="flex gap-0.5 flex-wrap max-w-[120px] justify-end">
            {player2Potted.map((n) => (
              <span
                key={n}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: BALL_COLORS[n]?.fill ?? "#666" }}
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="relative flex items-center justify-center gap-0">
        <canvas
          ref={canvasRef}
          width={tableSize.width}
          height={tableSize.height}
          className="touch-none rounded-lg min-w-[min(100%,600px)] w-full max-w-[100%]"
          style={{ aspectRatio: "2/1", minWidth: 350 }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
      {placingCue && (
        <p className="mt-2 text-sm text-teal">
          Ball in Hand — {placeValid ? "Click to place the cue ball" : "Cannot place on another ball"}
        </p>
      )}
    </div>
  );
}
