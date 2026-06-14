"use client";

import { useEffect, useState } from "react";
import { checkAdminAccess } from "@/lib/admin-auth";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    checkAdminAccess().then((ok) => {
      if (cancelled) return;
      if (!ok) {
        window.location.href = "/";
        return;
      }
      setChecked(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0E0E12]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0E0E12] text-[#F0F0F4]">
      <AdminSidebar />
      <main className="min-h-screen lg:ml-60">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
