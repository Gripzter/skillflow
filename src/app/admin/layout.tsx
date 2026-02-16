"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import AdminNavbar from "@/components/admin/AdminNavbar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) {
      setChecked(true);
      return;
    }
    const ok = isAdminAuthenticated();
    if (!ok) {
      router.replace("/admin/login");
      return;
    }
    setChecked(true);
  }, [isLoginPage, pathname, router]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-admin-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-admin-accent border-t-transparent" />
      </div>
    );
  }

  if (isLoginPage) {
    return <div className="min-h-screen bg-admin-bg">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-admin-bg">
      <AdminNavbar />
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
