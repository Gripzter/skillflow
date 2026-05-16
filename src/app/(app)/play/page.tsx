import { Suspense } from "react";
import PlayContent from "./PlayContent";

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0E0E12]" />}>
      <PlayContent />
    </Suspense>
  );
}
