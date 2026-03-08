/**
 * Connection quality testing for SkillFlow.
 * Provides live metrics: ping, jitter, download speed, packet loss.
 * Uses navigator.connection when available; falls back to fetch-based testing.
 */

export type ConnectionRating = "good" | "medium" | "warning" | "unrecommended";

export interface ConnectionMetrics {
  ping: number;
  pingAvg: number;
  jitter: number;
  downloadSpeed: number;
  packetLoss: number;
  connectionType: string;
  overallRating: ConnectionRating;
  lastUpdated: number;
  pingHistory: number[];
  pingMin?: number;
  pingMax?: number;
}

const PING_HISTORY_SIZE = 10;
const PACKET_LOSS_HISTORY_SIZE = 20;
const PING_INTERVAL_MS = 3000;
const SPEED_TEST_INTERVAL_MS = 60000;
const SPEED_TEST_SIZE = 100 * 1024; // 100KB

const RATING_THRESHOLDS = {
  good: { ping: 150, jitter: 30, packetLoss: 2 },
  medium: { ping: 300, jitter: 50, packetLoss: 5 },
  warning: { ping: 450, jitter: 80, packetLoss: 10 },
};

function getRatingFromMetrics(ping: number, jitter: number, packetLoss: number): ConnectionRating {
  if (ping < RATING_THRESHOLDS.good.ping && jitter < RATING_THRESHOLDS.good.jitter && packetLoss < RATING_THRESHOLDS.good.packetLoss) return "good";
  if (ping < RATING_THRESHOLDS.medium.ping && jitter < RATING_THRESHOLDS.medium.jitter && packetLoss < RATING_THRESHOLDS.medium.packetLoss) return "medium";
  if (ping < RATING_THRESHOLDS.warning.ping && jitter < RATING_THRESHOLDS.warning.jitter && packetLoss < RATING_THRESHOLDS.warning.packetLoss) return "warning";
  return "unrecommended";
}

function measurePingViaFetch(): Promise<number> {
  const start = performance.now();
  const url = typeof window !== "undefined" ? `${window.location.origin}/api/connection-ping` : "/api/connection-ping";
  return fetch(url, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  })
    .then(() => performance.now() - start)
    .catch(() => -1);
}

function getConnectionType(): string {
  if (typeof navigator === "undefined" || !navigator.connection) return "Unknown";
  const conn = navigator.connection as {
    effectiveType?: string;
    type?: string;
    rtt?: number;
  };
  const parts: string[] = [];
  if (conn.type) parts.push(conn.type);
  if (conn.effectiveType) parts.push(conn.effectiveType);
  if (parts.length) return parts.join(" / ");
  return "Unknown";
}

function measureDownloadSpeed(): Promise<number> {
  if (typeof window === "undefined") return Promise.resolve(0);
  const url = `${window.location.origin}/api/connection-speed`;
  const start = performance.now();
  return fetch(url, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  })
    .then(async (res) => {
      const blob = await res.blob();
      const durationSec = (performance.now() - start) / 1000;
      const bytes = blob.size || SPEED_TEST_SIZE;
      const Mbps = (bytes * 8) / 1_000_000 / durationSec;
      return Math.round(Mbps * 10) / 10;
    })
    .catch(() => 0);
}

const defaultMetrics: ConnectionMetrics = {
  ping: 0,
  pingAvg: 0,
  jitter: 0,
  downloadSpeed: 0,
  packetLoss: 0,
  connectionType: "Unknown",
  overallRating: "good",
  lastUpdated: 0,
  pingHistory: [],
};

let metrics: ConnectionMetrics = { ...defaultMetrics };
let listeners: Set<(m: ConnectionMetrics) => void> = new Set();
let pingHistory: number[] = [];
let packetLossHistory: boolean[] = [];
let pingInterval: ReturnType<typeof setInterval> | null = null;
let speedInterval: ReturnType<typeof setInterval> | null = null;
let speedTestRunning = false;

function updateMetrics(partial: Partial<ConnectionMetrics>) {
  metrics = { ...metrics, ...partial, lastUpdated: Date.now() };
  listeners.forEach((fn) => fn(metrics));
}

function computeJitter(pings: number[]): number {
  if (pings.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < pings.length; i++) {
    sum += Math.abs(pings[i]! - pings[i - 1]!);
  }
  return Math.round((sum / (pings.length - 1)) * 10) / 10;
}

function runPingTest() {
  if (typeof window === "undefined") return;
  measurePingViaFetch().then((pingMs) => {
    const success = pingMs >= 0;
    packetLossHistory.push(success);
    if (packetLossHistory.length > PACKET_LOSS_HISTORY_SIZE) {
      packetLossHistory.shift();
    }
    const packetLoss = packetLossHistory.length
      ? Math.round((packetLossHistory.filter((f) => !f).length / packetLossHistory.length) * 1000) / 10
      : 0;

    if (success) {
      pingHistory.push(pingMs);
      if (pingHistory.length > PING_HISTORY_SIZE) pingHistory.shift();
    }

    const validPings = pingHistory.filter((p) => p >= 0);
    const ping = validPings.length ? validPings[validPings.length - 1]! : 0;
    const pingAvg = validPings.length ? Math.round(validPings.reduce((a, b) => a + b, 0) / validPings.length) : 0;
    const jitter = computeJitter(validPings);
    const rating = getRatingFromMetrics(pingAvg || ping, jitter, packetLoss);

    updateMetrics({
      ping,
      pingAvg: pingAvg || ping,
      jitter,
      packetLoss,
      connectionType: getConnectionType(),
      overallRating: rating,
      pingHistory: [...validPings],
      pingMin: validPings.length ? Math.min(...validPings) : undefined,
      pingMax: validPings.length ? Math.max(...validPings) : undefined,
    });
  });
}

function runSpeedTest() {
  if (typeof window === "undefined" || speedTestRunning) return;
  speedTestRunning = true;
  measureDownloadSpeed()
    .then((Mbps) => {
      updateMetrics({ downloadSpeed: Mbps });
    })
    .finally(() => {
      speedTestRunning = false;
    });
}

export function startConnectionTester() {
  if (typeof window === "undefined") return;
  if (pingInterval) return;
  runPingTest();
  runSpeedTest();
  pingInterval = setInterval(runPingTest, PING_INTERVAL_MS);
  speedInterval = setInterval(runSpeedTest, SPEED_TEST_INTERVAL_MS);
}

export function stopConnectionTester() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  if (speedInterval) {
    clearInterval(speedInterval);
    speedInterval = null;
  }
}

export function subscribeConnectionMetrics(cb: (m: ConnectionMetrics) => void): () => void {
  listeners.add(cb);
  cb(metrics);
  return () => listeners.delete(cb);
}

export function getConnectionMetrics(): ConnectionMetrics {
  return { ...metrics };
}

export function runFullSpeedTest(): Promise<ConnectionMetrics> {
  return new Promise((resolve) => {
    runPingTest();
    measureDownloadSpeed().then((Mbps) => {
      const m = getConnectionMetrics();
      updateMetrics({ downloadSpeed: Mbps });
      resolve(getConnectionMetrics());
    });
  });
}
