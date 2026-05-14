"use client";

export default function LoadingRing() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0E0E12]">
      <div
        className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#FFFF00] border-t-transparent"
        aria-label="Loading"
        role="status"
      />
    </div>
  );
}
