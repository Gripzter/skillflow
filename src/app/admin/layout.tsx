"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkAdminAccess } from "@/lib/admin-auth";
import AdminSidebar from "@/components/admin/AdminSidebar";
import VelocityLoader from "@/components/VelocityLoader";

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
    return <VelocityLoader />;
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
