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
        window.location.href = "/admin/login";
        return;
      }
      setChecked(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!checked) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-admin-bg">
      <AdminSidebar />
      <main className="ml-56 flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] p-8">{children}</div>
      </main>
    </div>
  );
}
