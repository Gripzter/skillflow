"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase";
import HeaderIconButton from "@/components/HeaderIconButton";
import { formatNotificationRelativeTime, type NotificationRow } from "@/lib/notifications";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const res = await fetch("/api/notifications", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return;

    const data = (await res.json()) as {
      notifications?: NotificationRow[];
      unreadCount?: number;
    };
    setNotifications(data.notifications ?? []);
    setUnreadCount(data.unreadCount ?? 0);
  }, []);

  useEffect(() => {
    void fetchNotifications();
    const interval = setInterval(() => void fetchNotifications(), 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleOpen = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen) return;

    setLoading(true);
    await fetchNotifications();

    const supabase = createClient();
    if (supabase) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      }
    }

    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setLoading(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <HeaderIconButton aria-label="Notifications" onClick={() => void handleOpen()}>
        <span className="relative inline-flex">
          <Bell size={20} strokeWidth={1.5} aria-hidden />
          {unreadCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FFFF00] px-0.5 text-[10px] font-bold leading-none text-black">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </span>
      </HeaderIconButton>

      {/* Desktop dropdown */}
      <div
        className={`absolute right-0 top-full z-[100] mt-1.5 hidden w-80 overflow-hidden rounded-xl border border-white/[0.08] bg-[#1A1A22] shadow-xl transition-all duration-200 md:block ${
          open
            ? "translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0"
        }`}
      >
        <NotificationList notifications={notifications} loading={loading} />
      </div>

      {/* Mobile bottom sheet */}
      {open ? (
        <div className="fixed inset-0 z-[100] md:hidden">
          <button
            type="button"
            aria-label="Close notifications"
            className="absolute inset-0 bg-black/75"
            onClick={() => setOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-white/[0.08] bg-[#1A1A22] pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-center py-3">
              <span className="h-1 w-10 rounded-full bg-white/20" />
            </div>
            <NotificationList notifications={notifications} loading={loading} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NotificationList({
  notifications,
  loading,
}: {
  notifications: NotificationRow[];
  loading: boolean;
}) {
  if (loading && notifications.length === 0) {
    return <p className="px-4 py-6 text-sm text-[#9CA3AF]">Loading...</p>;
  }

  if (notifications.length === 0) {
    return <p className="px-4 py-6 text-sm text-[#9CA3AF]">No notifications yet.</p>;
  }

  return (
    <ul>
      {notifications.map((n, i) => (
        <li
          key={n.id}
          className={`px-4 py-3 ${i > 0 ? "border-t border-white/[0.08]" : ""}`}
        >
          <p className="text-sm text-white">{n.message}</p>
          <p className="mt-1 text-xs text-[#9CA3AF]">
            {formatNotificationRelativeTime(n.created_at)}
          </p>
        </li>
      ))}
    </ul>
  );
}
