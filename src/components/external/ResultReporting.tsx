"use client";

import { useState, useRef } from "react";
import type { ExternalMatchResult } from "@/lib/external-matches";

interface ResultReportingProps {
  onSubmit: (result: ExternalMatchResult) => void;
  disabled?: boolean;
}

export default function ResultReporting({ onSubmit, disabled }: ResultReportingProps) {
  const [outcome, setOutcome] = useState<"self" | "opponent" | "draw">("self");
  const [myScore, setMyScore] = useState("");
  const [opponentScore, setOpponentScore] = useState("");
  const [shareCode, setShareCode] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [demoFile, setDemoFile] = useState<File | null>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const demoInputRef = useRef<HTMLInputElement>(null);

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setScreenshotFile(file);
      console.log("[ResultReporting] Screenshot selected:", file.name);
    }
    e.target.value = "";
  };

  const handleDemoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith(".dem")) {
      setDemoFile(file);
      console.log("[ResultReporting] Demo file selected:", file.name);
    }
    e.target.value = "";
  };

  const handleSubmit = () => {
    const score = `${myScore}-${opponentScore}`.replace(/^-|-$/g, "") || "0-0";
    const proof = screenshotFile || demoFile || (shareCode.trim() || undefined);
    const proofStr = typeof proof === "string" ? proof : proof ? `file:${proof.name}` : "";
    const result: ExternalMatchResult = {
      winner: outcome,
      score: score || "0-0",
      proofUrl: proofStr,
    };
    onSubmit(result);
  };

  const hasProof = !!screenshotFile || !!demoFile || !!shareCode.trim();

  return (
    <div className="card-border rounded-card bg-card p-6">
      <h3 className="text-lg font-bold text-white">Report Match Result</h3>

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-white">Result</p>
          <div className="flex flex-wrap gap-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="outcome"
                checked={outcome === "self"}
                onChange={() => setOutcome("self")}
                className="h-4 w-4 accent-teal"
              />
              <span className={`rounded-lg px-4 py-2 ${outcome === "self" ? "border border-teal bg-teal/20 text-teal" : "border border-white/10 text-body-gray"}`}>
                I Won
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="outcome"
                checked={outcome === "opponent"}
                onChange={() => setOutcome("opponent")}
                className="h-4 w-4 accent-teal"
              />
              <span className={`rounded-lg px-4 py-2 ${outcome === "opponent" ? "border border-teal bg-teal/20 text-teal" : "border border-white/10 text-body-gray"}`}>
                I Lost
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="outcome"
                checked={outcome === "draw"}
                onChange={() => setOutcome("draw")}
                className="h-4 w-4 accent-teal"
              />
              <span className={`rounded-lg px-4 py-2 ${outcome === "draw" ? "border border-amber-500/50 bg-amber-500/20 text-amber-400" : "border border-white/10 text-body-gray"}`}>
                Draw / No Result
              </span>
            </label>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-white">Score</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Your Score"
              value={myScore}
              onChange={(e) => setMyScore(e.target.value.replace(/\D/g, ""))}
              className="w-24 rounded-lg border border-white/10 bg-[#1A1D27] px-4 py-2 text-center text-white placeholder:text-body-gray focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            <span className="text-body-gray">—</span>
            <input
              type="text"
              placeholder="Opponent"
              value={opponentScore}
              onChange={(e) => setOpponentScore(e.target.value.replace(/\D/g, ""))}
              className="w-24 rounded-lg border border-white/10 bg-[#1A1D27] px-4 py-2 text-center text-white placeholder:text-body-gray focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-white">Proof (required)</p>
          <div className="flex flex-wrap gap-3">
            <input
              ref={screenshotInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleScreenshotChange}
            />
            <button
              type="button"
              onClick={() => screenshotInputRef.current?.click()}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-body-gray hover:bg-white/5 hover:text-white"
            >
              Upload Screenshot
            </button>
            <input
              ref={demoInputRef}
              type="file"
              accept=".dem"
              className="hidden"
              onChange={handleDemoChange}
            />
            <button
              type="button"
              onClick={() => demoInputRef.current?.click()}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-body-gray hover:bg-white/5 hover:text-white"
            >
              Upload Demo File
            </button>
          </div>
          <input
            type="text"
            placeholder="Or paste match share code"
            value={shareCode}
            onChange={(e) => setShareCode(e.target.value)}
            className="mt-2 w-full max-w-xs rounded-lg border border-white/10 bg-[#1A1D27] px-4 py-2 text-white placeholder:text-body-gray focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
          <p className="mt-2 text-xs text-body-gray">At least one form of proof is required</p>
          {(screenshotFile || demoFile) && (
            <p className="mt-1 text-xs text-teal">
              Selected: {screenshotFile?.name || demoFile?.name}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || !hasProof}
          className="mt-4 w-full rounded-lg bg-teal py-3 font-semibold text-charcoal transition-all hover:shadow-teal-glow disabled:cursor-not-allowed disabled:opacity-50"
        >
          Submit Result
        </button>
      </div>
    </div>
  );
}
