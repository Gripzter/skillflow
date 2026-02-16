/**
 * Connection quality logging for match records.
 * Logs snapshots during matches for dispute resolution.
 */

import type { ConnectionRating } from "./connection-tester";
import { getConnectionMetrics } from "./connection-tester";

export interface ConnectionSnapshot {
  timestamp: string;
  ping: number;
  jitter: number;
  packetLoss: number;
  rating: ConnectionRating;
}

export interface ConnectionWarningAck {
  timestamp: string;
  rating: "warning" | "unrecommended";
}

export interface ConnectionLogData {
  connectionLog: ConnectionSnapshot[];
  connectionWarningAcknowledged: false | ConnectionWarningAck;
}

const LOG_INTERVAL_MS = 5000;

let logInterval: ReturnType<typeof setInterval> | null = null;
let onLogCallback: ((snapshot: ConnectionSnapshot) => void) | null = null;

export function startConnectionLogging(onSnapshot: (snapshot: ConnectionSnapshot) => void) {
  if (logInterval) return;
  onLogCallback = onSnapshot;
  const capture = () => {
    const m = getConnectionMetrics();
    const snapshot: ConnectionSnapshot = {
      timestamp: new Date().toISOString(),
      ping: m.pingAvg || m.ping,
      jitter: m.jitter,
      packetLoss: m.packetLoss,
      rating: m.overallRating,
    };
    onSnapshot(snapshot);
  };
  capture();
  logInterval = setInterval(capture, LOG_INTERVAL_MS);
}

export function stopConnectionLogging() {
  if (logInterval) {
    clearInterval(logInterval);
    logInterval = null;
  }
  onLogCallback = null;
}

export function createEmptyConnectionLog(): ConnectionLogData {
  return {
    connectionLog: [],
    connectionWarningAcknowledged: false,
  };
}
