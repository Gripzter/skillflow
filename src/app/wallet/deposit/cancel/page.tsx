import { Suspense } from "react";
import CancelContent from "./CancelContent";

export default function CancelPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0E0E12]" />}>
      <CancelContent />
    </Suspense>
  );
}
