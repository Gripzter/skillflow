"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  startConnectionTester,
  stopConnectionTester,
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
  good: { bg: "#22C55E", text: "white", label: "● GOOD", icon: "●" },
  medium: { bg: "#EAB308", text: "#171717", label: "● MEDIUM", icon: "●" },
  warning: { bg: "#F97316", text: "white", label: "⚠ WARNING", icon: "⚠" },
  unrecommended: { bg: "#EF4444", text: "white", label: "⛔ UNRECOMMENDED", icon: "⛔" },
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
  if (t.includes("ethernet")) return "🔌";
  if (t.includes("wifi") || t.includes("wlan")) return "📶";
  if (t.includes("4g") || t.includes("3g") || t.includes("cellular")) return "📱";
  return "📶";
}

function formatTimeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec} seconds ago`;
  return `${Math.floor(sec / 60)} minutes ago`;
}

export default function ConnectionMonitor() {
  const [metrics, setMetrics] = useState<ConnectionMetrics>(getConnectionMetrics);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [fullTestRunning, setFullTestRunning] = useState(false);
  const [lastRating, setLastRating] = useState<ConnectionRating>(metrics.overallRating);
  const [flashWarning, setFlashWarning] = useState(false);

  useEffect(() => {
    startConnectionTester();
    return () => stopConnectionTester();
  }, []);

  useEffect(() => {
    return subscribeConnectionMetrics(setMetrics);
  }, []);

  useEffect(() => {
    if (metrics.overallRating === "warning" || metrics.overallRating === "unrecommended") {
      if (lastRating === "good" || lastRating === "medium") {
        setFlashWarning(true);
        const t = setTimeout(() => setFlashWarning(false), 1500);
        return () => clearTimeout(t);
      }
    }
    setLastRating(metrics.overallRating);
  }, [metrics.overallRating, lastRating]);

  const handleFullSpeedTest = useCallback(async () => {
    setFullTestRunning(true);
    try {
      await runFullSpeedTest();
    } finally {
      setFullTestRunning(false);
    }
  }, []);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const ratingStyle = RATING_STYLES[metrics.overallRating];

  const metricContent = useMemo(() => {
    const pingColor = getPingColor(metrics.pingAvg || metrics.ping);
    const jitterColor = getJitterColor(metrics.jitter);
    const lossColor = getPacketLossColor(metrics.packetLoss);
    const speedColor = getSpeedColor(metrics.downloadSpeed);
    const gray = "#6B7280";

    if (isMobile) {
      return (
        <span className="flex items-center gap-2 font-mono text-[11px]">
          <span style={{ color: gray }}>Ping:</span>
          <span style={{ color: pingColor }}>{Math.round(metrics.pingAvg || metrics.ping)}ms</span>
          <span className="opacity-50">|</span>
          <span style={{ color: gray }}>Loss:</span>
          <span style={{ color: lossColor }}>{metrics.packetLoss}%</span>
        </span>
      );
    }

    return (
      <span className="flex items-center gap-2 font-mono text-[11px]">
        <span style={{ color: gray }}>Ping:</span>
        <span className="tabular-nums transition-opacity duration-300" style={{ color: pingColor }}>
          {Math.round(metrics.pingAvg || metrics.ping)}ms
        </span>
        <span className="opacity-50">|</span>
        <span style={{ color: gray }}>Jitter:</span>
        <span className="tabular-nums transition-opacity duration-300" style={{ color: jitterColor }}>
          {metrics.jitter}ms
        </span>
        <span className="opacity-50">|</span>
        <span style={{ color: gray }}>Loss:</span>
        <span className="tabular-nums transition-opacity duration-300" style={{ color: lossColor }}>
          {metrics.packetLoss}%
        </span>
        <span className="opacity-50">|</span>
        <span style={{ color: gray }}>Speed:</span>
        <span className="tabular-nums transition-opacity duration-300" style={{ color: speedColor }}>
          {metrics.downloadSpeed} Mbps
        </span>
      </span>
    );
  }, [metrics, isMobile]);

  const tips = useMemo(() => {
    if (metrics.overallRating === "warning")
      return "Consider switching to a wired ethernet connection for better stability.";
    if (metrics.overallRating === "unrecommended")
      return "Your connection may cause issues during competitive matches. We strongly recommend improving your connection before wagering.";
    return "";
  }, [metrics.overallRating]);

  return (
    <>
      <div
        className={`fixed left-0 right-0 top-0 z-[100] flex h-6 items-center justify-between border-b px-4 transition-all duration-300 md:h-7 ${
          flashWarning ? "animate-pulse" : ""
        }`}
        style={{
          backgroundColor: flashWarning ? ratingStyle.bg + "20" : "#0A0C10",
          borderColor: "rgba(255,255,255,0.05)",
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowModal(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setShowModal(true)}
        aria-label="Connection quality monitor"
      >
        <div className="flex flex-1 items-center justify-center gap-4">
          <span
            className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all duration-300"
            style={{ backgroundColor: ratingStyle.bg, color: ratingStyle.text }}
          >
            <span className="animate-pulse" aria-hidden>{ratingStyle.icon}</span> {ratingStyle.label}
          </span>
          {metricContent}
        </div>
        <span className="ml-2 flex items-center gap-1 text-[11px]" style={{ color: "#6B7280" }}>
          {getConnectionIcon(metrics.connectionType)} {metrics.connectionType}
        </span>
      </div>

      {showTooltip && (
        <div
          className="fixed left-4 top-12 z-[101] w-64 rounded-lg border border-white/10 bg-[#151821] p-3 text-xs shadow-xl"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <p className="font-semibold text-white">Connection Quality Report</p>
          <div className="mt-2 space-y-1 font-mono text-body-gray">
            <p>Current ping: {Math.round(metrics.ping)}ms</p>
            <p>Avg ping (30s): {Math.round(metrics.pingAvg || metrics.ping)}ms</p>
            {metrics.pingMin != null && metrics.pingMax != null && (
              <p>Range: {metrics.pingMin}ms - {metrics.pingMax}ms</p>
            )}
            <p>Jitter: {metrics.jitter}ms</p>
            <p>Packet loss: {metrics.packetLoss}%</p>
            <p>Download: {metrics.downloadSpeed} Mbps</p>
            <p>Type: {metrics.connectionType}</p>
            <p className="mt-2 text-body-gray/80">Last tested: {formatTimeAgo(metrics.lastUpdated)}</p>
          </div>
          {metrics.pingHistory.length >= 2 && (
            <div className="mt-2 flex h-8 items-end gap-0.5">
              {metrics.pingHistory.slice(-20).map((p, i) => (
                <div
                  key={i}
                  className="flex-1 min-w-[2px] rounded-t transition-colors"
                  style={{
                    height: `${Math.min(100, (p / 150) * 100)}%`,
                    backgroundColor: getPingColor(p),
                  }}
                  title={`${p}ms`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div
            className="card-border w-full max-w-md rounded-card bg-card p-6 md:max-w-lg"
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
              className="mt-6 w-full rounded-lg bg-teal py-3 font-semibold text-charcoal transition-all hover:shadow-teal-glow disabled:opacity-50"
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

      <div className="h-6 md:h-7" aria-hidden />
    </>
  );
}
