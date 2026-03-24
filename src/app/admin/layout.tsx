"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAdminAccess } from "@/lib/admin-auth";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    checkAdminAccess().then((ok) => {
      if (!ok) {
        router.replace("/login");
        return;
      }
      setChecked(true);
    });
  }, [router]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080A0E]">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: "#FF5E00", borderTopColor: "transparent" }}
        />
      </div>
    );
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
