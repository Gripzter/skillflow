"use client";

import { useEffect } from "react";

export default function AdminLoginRedirect() {
  useEffect(() => {
    window.location.href = "/login";
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0E0E12]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
    </div>
  );
}
