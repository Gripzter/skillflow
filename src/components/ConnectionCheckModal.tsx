"use client";

import { useState } from "react";
import type { ConnectionMetrics, ConnectionRating } from "@/lib/connection-tester";
import type { ConnectionWarningAck } from "@/lib/connection-logger";

const RATING_LABELS: Record<ConnectionRating, string> = {
  good: " Connection OK",
  medium: " Connection OK",
  warning: "Connection Warning",
  unrecommended: "Connection Not Recommended",
};

interface ConnectionCheckModalProps {
  metrics: ConnectionMetrics;
  onContinue: (ack: ConnectionWarningAck | null) => void;
  onCancel: () => void;
}

export function ConnectionCheckWarning({ metrics, onContinue, onCancel }: ConnectionCheckModalProps) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 md:p-0">
      <div className="card-border w-full max-w-md rounded-card bg-card p-6 md:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-white">{RATING_LABELS.warning}</h2>
        <p className="mt-3 text-body-gray">
          Your internet connection is currently unstable. This may affect your gameplay experience.
        </p>
        <div className="mt-4 rounded-lg border border-white/10 bg-[#1A1D27] p-4 font-mono text-sm">
          <p className="text-body-gray">Ping: <span className={metrics.pingAvg >= 100 ? "text-yellow-400" : "text-teal"}>{Math.round(metrics.pingAvg || metrics.ping)}ms</span></p>
          <p className="mt-1 text-body-gray">Jitter: <span className={metrics.jitter >= 30 ? "text-yellow-400" : "text-teal"}>{metrics.jitter}ms</span></p>
          <p className="mt-1 text-body-gray">Packet loss: <span className={metrics.packetLoss >= 2 ? "text-yellow-400" : "text-teal"}>{metrics.packetLoss}%</span></p>
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-4 w-4 accent-teal"
          />
          <span className="text-sm text-body-gray">
            I understand that SkillFlow is not responsible for gameplay issues caused by my internet connection
          </span>
        </label>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/20 py-3 text-white hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onContinue({ timestamp: new Date().toISOString(), rating: "warning" })}
            disabled={!checked}
            className="flex-1 rounded-lg bg-teal py-3 font-semibold text-charcoal hover:shadow-teal-glow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConnectionCheckUnrecommended({ metrics, onContinue, onCancel }: ConnectionCheckModalProps) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="fixed inset-0 z-[200] flex min-h-screen items-center justify-center bg-black/90 p-4 md:min-h-0 md:p-0">
      <div className="card-border w-full max-w-md rounded-card bg-card p-6 md:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-red-400">{RATING_LABELS.unrecommended}</h2>
        <p className="mt-3 text-body-gray">
          Your internet connection quality is below the minimum recommended for competitive play. Playing with this connection is highly likely to cause lag, disconnections, and a poor experience.
        </p>
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 font-mono text-sm">
          <p className="text-body-gray">Ping: <span className="text-red-400">{Math.round(metrics.pingAvg || metrics.ping)}ms</span></p>
          <p className="mt-1 text-body-gray">Jitter: <span className="text-red-400">{metrics.jitter}ms</span></p>
          <p className="mt-1 text-body-gray">Packet loss: <span className="text-red-400">{metrics.packetLoss}%</span></p>
          <p className="mt-1 text-body-gray">Speed: <span className="text-red-400">{metrics.downloadSpeed} Mbps</span></p>
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-4 w-4 accent-red-500"
          />
          <span className="text-sm text-body-gray">
            I acknowledge that my connection is unstable and I accept full responsibility for any gameplay issues. I understand that match results will not be reversed due to connection problems.
          </span>
        </label>
        <div className="mt-6 flex flex-col gap-3 md:flex-row">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-white/20 py-3 font-medium text-white hover:bg-white/5 md:order-2"
          >
            Go Back
          </button>
          <button
            type="button"
            onClick={() => onContinue({ timestamp: new Date().toISOString(), rating: "unrecommended" })}
            disabled={!checked}
            className="flex-1 rounded-lg border border-red-500/50 bg-red-500/20 py-3 font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed md:order-1"
          >
            I Accept the Risk — Continue
          </button>
        </div>
      </div>
    </div>
  );
}
