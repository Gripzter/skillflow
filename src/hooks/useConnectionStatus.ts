"use client";

import { useEffect, useState } from "react";
import {
  getConnectionMetrics,
  subscribeConnectionMetrics,
  type ConnectionMetrics,
} from "@/lib/connection-tester";

export type ConnectionStatus = {
  /** Hex color for the status indicator (dot or icon). */
  color: string;
  /** Human-readable label for tooltips / aria. */
  label: string;
  /** True once a real ping measurement has resolved. */
  hasRealMeasurement: boolean;
  metrics: ConnectionMetrics;
};

/**
 * Shared connection-quality state for the desktop Wifi badge and the mobile
 * header status dot. Colors only reflect real measured state — gray until the
 * first ping resolves (and during the initial grace window).
 */
export function useConnectionStatus(): ConnectionStatus {
  const [metrics, setMetrics] = useState<ConnectionMetrics>(getConnectionMetrics);
  const [grace, setGrace] = useState(true);

  useEffect(() => subscribeConnectionMetrics(setMetrics), []);

  useEffect(() => {
    const t = setTimeout(() => setGrace(false), 5000);
    return () => clearTimeout(t);
  }, []);

  const effectivePing = Math.round(metrics.pingAvg || metrics.ping);
  const hasRealMeasurement =
    metrics.lastUpdated > 0 && (metrics.pingAvg > 0 || metrics.ping > 0);

  let color = "#9CA3AF";
  let label = "Checking connection";

  if (hasRealMeasurement && !grace) {
    if (metrics.overallRating === "good" || metrics.overallRating === "medium") {
      color = "#FFFF00";
      label = metrics.overallRating === "good" ? "Strong connection" : "Fair connection";
    } else {
      color = "#EF4444";
      label = metrics.overallRating === "warning" ? "Weak connection" : "Poor connection";
    }
  }

  const tooltip =
    hasRealMeasurement ? `${label} · ${effectivePing}ms` : label;

  return { color, label: tooltip, hasRealMeasurement, metrics };
}
