import { Suspense } from "react";
import type { Metadata } from "next";
import PlayContent from "@/app/(app)/play/PlayContent";

export const metadata: Metadata = {
  title: "SkillFlow — Skill-Based Competitive Gaming",
  description:
    "Play skill-based games, earn SkillPoints, and compete on the leaderboard. Free to play during beta.",
};

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0E0E12]" />}>
      <PlayContent />
    </Suspense>
  );
}
