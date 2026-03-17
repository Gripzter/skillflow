"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePlayMode } from "@/contexts/PlayModeContext";
import {
  subscribeConnectionMetrics,
  runFullSpeedTest,
  getConnectionMetrics,
  type ConnectionMetrics,
  type ConnectionRating,
} from "@/lib/connection-tester";

const RATING_STYLES: Record<
  ConnectionRating,
  { bg: string; text: string; label: string; icon: string }
> = {
  good: { bg: "#22C55E", text: "white", label: "GOOD", icon: "" },
  medium: { bg: "#EAB308", text: "#171717", label: "MEDIUM", icon: "" },
  warning: { bg: "#F97316", text: "white", label: "WARNING", icon: "" },
  unrecommended: { bg: "#EF4444", text: "white", label: "BAD", icon: "" },
};

function getPingColor(ping: number): string {
  if (ping < 50) return "#22C55E";
  if (ping < 100) return "#EAB308";
  if (ping < 150) return "#F97316";
  return "#EF4444";
}

function getJitterColor(jitter: number): string {
  if (jitter < 15) return "#22C55E";
  if (jitter < 30) return "#EAB308";
  if (jitter < 50) return "#F97316";
  return "#EF4444";
}

function getPacketLossColor(loss: number): string {
  if (loss < 1) return "#22C55E";
  if (loss < 2) return "#EAB308";
  if (loss < 5) return "#F97316";
  return "#EF4444";
}

function getSpeedColor(speed: number): string {
  if (speed >= 25) return "#22C55E";
  if (speed >= 10) return "#EAB308";
  if (speed >= 5) return "#F97316";
  return "#EF4444";
}

function getConnectionIcon(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("ethernet")) return "";
  if (t.includes("wifi") || t.includes("wlan")) return "";
  if (t.includes("4g") || t.includes("3g") || t.includes("cellular")) return "";
  return "";
}

function formatTimeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  return `${Math.floor(sec / 60)} min ago`;
}

function MetricDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

export default function ConnectionBadge() {
  const { isPractice } = usePlayMode();
  const [metrics, setMetrics] = useState<ConnectionMetrics>(getConnectionMetrics);
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [fullTestRunning, setFullTestRunning] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [grace, setGrace] = useState(true);

  useEffect(() => {
    return subscribeConnectionMetrics(setMetrics);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setGrace(false), 5000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleFullSpeedTest = useCallback(async () => {
    setFullTestRunning(true);
    try {
      await runFullSpeedTest();
    } finally {
      setFullTestRunning(false);
    }
  }, []);

  const ratingStyle = RATING_STYLES[metrics.overallRating];
  const pingColor = getPingColor(metrics.pingAvg || metrics.ping);
  const jitterColor = getJitterColor(metrics.jitter);
  const lossColor = getPacketLossColor(metrics.packetLoss);
  const speedColor = getSpeedColor(metrics.downloadSpeed);

  const tips =
    metrics.overallRating === "warning"
      ? "Consider switching to a wired ethernet connection for better stability."
      : metrics.overallRating === "unrecommended"
        ? "Your connection may cause issues during competitive matches. We strongly recommend improving your connection before wagering."
        : "";

  const effectiveRating: ConnectionRating = grace ? "good" : metrics.overallRating;
  const effectivePing = Math.round(metrics.pingAvg || metrics.ping);

  let level = 4;
  if (!grace) {
    if (effectiveRating === "good") level = 4;
    else if (effectiveRating === "medium") level = 3;
    else if (effectiveRating === "warning") level = 2;
    else level = 1;
  }

  const dotOn = level >= 1;
  const arc1On = level >= 2;
  const arc2On = level >= 3;
  const arc3On = level >= 4;

  let wifiColor = "#22C55E";
  let levelLabel = "Strong connection";
  if (level === 3) {
    wifiColor = "#FACC15";
    levelLabel = "Fair connection";
  } else if (level === 2) {
    wifiColor = "#EF4444";
    levelLabel = "Weak connection";
  } else if (level === 1) {
    wifiColor = "#EF4444";
    levelLabel = "Poor connection";
  }

  const tooltipText = `${levelLabel} · ${effectivePing}ms`;

  return (
    <>
      <div
        ref={containerRef}
        className="connection-badge relative flex items-center"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center justify-center rounded-full p-1.5 text-[11px] font-bold transition-colors hover:bg-white/5"
          aria-label="Connection quality"
          aria-expanded={open}
          title={tooltipText}
        >
          <svg
            className="h-8 w-8"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            {/* outer arc */}
            <path
              d="M4.5 9.5C8.2 6.3 15.8 6.3 19.5 9.5"
              stroke={arc3On ? wifiColor : "#2A2A38"}
              strokeWidth={3}
              strokeLinecap="round"
            />
            {/* middle arc */}
            <path
              d="M7 12c3-2.5 7-2.5 10 0"
              stroke={arc2On ? wifiColor : "#2A2A38"}
              strokeWidth={3}
              strokeLinecap="round"
            />
            {/* inner arc */}
            <path
              d="M9.5 14.5c1.5-1.3 3.5-1.3 5 0"
              stroke={arc1On ? wifiColor : "#2A2A38"}
              strokeWidth={3}
              strokeLinecap="round"
            />
            {/* dot */}
            <circle
              cx="12"
              cy="18"
              r="2.1"
              fill={dotOn ? wifiColor : "#2A2A38"}
            />
          </svg>
        </button>

        {/* Dropdown */}
        <div
          className={`absolute right-0 top-full z-[100] mt-1.5 min-w-[240px] rounded-xl border border-white/10 bg-card p-4 shadow-xl transition-all duration-200 ${
            open
              ? "translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-1 opacity-0"
          }`}
          style={{ backgroundColor: "#1A1A22" }}
        >
          <p className="text-sm font-semibold text-white">
            Connection Quality: {ratingStyle.label}
          </p>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="text-body-gray">Ping</span>
              <span className="flex items-center gap-1.5 tabular-nums" style={{ color: pingColor }}>
                {Math.round(metrics.pingAvg || metrics.ping)}ms
                <MetricDot color={pingColor} />
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-body-gray">Jitter</span>
              <span className="flex items-center gap-1.5 tabular-nums" style={{ color: jitterColor }}>
                {metrics.jitter}ms
                <MetricDot color={jitterColor} />
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-body-gray">Loss</span>
              <span className="flex items-center gap-1.5 tabular-nums" style={{ color: lossColor }}>
                {metrics.packetLoss}%
                <MetricDot color={lossColor} />
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-body-gray">Speed</span>
              <span className="flex items-center gap-1.5 tabular-nums" style={{ color: speedColor }}>
                {metrics.downloadSpeed} Mbps
                <MetricDot color={speedColor} />
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-body-gray">Type</span>
              <span className="flex items-center gap-1.5 text-white">
                {metrics.connectionType}
              </span>
            </div>
          </div>
          <p className="mt-3 border-t border-white/5 pt-2 text-[11px] text-body-gray">
            Last tested: {formatTimeAgo(metrics.lastUpdated)}
          </p>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setShowModal(true);
            }}
            className={`mt-2 w-full rounded-lg border border-white/10 py-1.5 text-xs hover:bg-white/5 ${
              isPractice ? "text-purple-400" : "text-teal"
            }`}
          >
            Run full speed test
          </button>
        </div>
      </div>

      {/* Full modal (speed test + tips) */}
      {showModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div
            className="card-border w-full max-w-md rounded-card bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">Connection Quality</h3>
            <p className="mt-2 text-sm text-body-gray">
              Your connection is{" "}
              <span style={{ color: ratingStyle.bg }}>{ratingStyle.label}</span> for competitive play.
            </p>
            {tips && (
              <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                {tips}
              </p>
            )}
            <div className="mt-4 space-y-2 font-mono text-sm text-body-gray">
              <p>Ping: {Math.round(metrics.pingAvg || metrics.ping)}ms | Jitter: {metrics.jitter}ms</p>
              <p>Packet loss: {metrics.packetLoss}% | Download: {metrics.downloadSpeed} Mbps</p>
            </div>
            <button
              type="button"
              onClick={handleFullSpeedTest}
              disabled={fullTestRunning}
              className={`mt-6 w-full rounded-lg py-3 font-semibold text-charcoal transition-all disabled:opacity-50 ${
                isPractice
                  ? "bg-purple-500 hover:shadow-[0_0_18px_rgba(139,92,246,0.45)]"
                  : "bg-teal hover:shadow-teal-glow"
              }`}
            >
              {fullTestRunning ? "Running Full Speed Test..." : "Run Full Speed Test"}
            </button>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="mt-3 w-full rounded-lg border border-white/20 py-2 text-sm text-body-gray hover:bg-white/5"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
