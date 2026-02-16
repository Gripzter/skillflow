"use client";

import { useEffect, useState, useMemo } from "react";
import { getMatches } from "@/lib/matchmaking";

type UserStatus = "Active" | "Suspended" | "New";

interface AdminUser {
  id: string;
  username: string;
  email: string;
  joined: string;
  matches: number;
  winRate: number;
  balance: number;
  totalWagered: number;
  status: UserStatus;
}

function generateFakeUsers(): AdminUser[] {
  const names = [
    "xKiller99", "PoolShark", "ChessMaster", "SniperElite", "NoScope360",
    "EzWin", "TryHard_1", "CasualPro", "DevPro", "AcePlayer", "QuickDraw",
    "LuckySeven", "DarkKnight", "StormRider", "ShadowFox", "NeonBlade",
    "PhoenixRise", "IceCold", "FireStorm", "ThunderBolt", "SilentAssassin",
    "GoldenEye", "SilverBullet", "CrimsonTide", "OceanView", "MountainKing",
  ];
  const users: AdminUser[] = [];
  const statuses: UserStatus[] = ["Active", "Active", "Active", "New", "Suspended"];
  for (let i = 0; i < 30; i++) {
    const name = names[i % names.length] + (i > names.length - 1 ? i : "");
    users.push({
      id: `user-${i}`,
      username: name,
      email: `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.com`,
      joined: new Date(Date.now() - Math.random() * 365 * 24 * 3600000).toISOString().slice(0, 10),
      matches: 5 + Math.floor(Math.random() * 200),
      winRate: Math.round(35 + Math.random() * 45),
      balance: Math.round((5 + Math.random() * 500) * 100) / 100,
      totalWagered: Math.round((100 + Math.random() * 5000) * 100) / 100,
      status: statuses[Math.floor(Math.random() * statuses.length)],
    });
  }
  return users.sort((a, b) => new Date(b.joined).getTime() - new Date(a.joined).getTime());
}

const PER_PAGE = 15;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "Active" | "Suspended" | "New">("all");
  const [page, setPage] = useState(0);
  const [suspendedIds, setSuspendedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let list = generateFakeUsers();
    const devUser = typeof window !== "undefined" ? localStorage.getItem("skillflow_dev_user") : null;
    if (devUser) {
      try {
        const dev = JSON.parse(devUser);
        const matches = getMatches();
        const wins = matches.filter((m) => m.winner === "player1").length;
        const completed = matches.filter((m) => m.status === "completed").length;
        list = [
          {
            id: "dev-user",
            username: dev.username || "Developer",
            email: "developer@skillflow.dev",
            joined: new Date().toISOString().slice(0, 10),
            matches: matches.length,
            winRate: completed ? Math.round((wins / completed) * 100) : 0,
            balance: parseFloat(localStorage.getItem("skillflow_wallet_balance") || "0") || 0,
            totalWagered: matches.reduce((s, m) => s + m.stakeAmount * 2, 0),
            status: "Active" as UserStatus,
          },
          ...list.filter((u) => u.id !== "dev-user"),
        ];
      } catch {
        // ignore
      }
    }
    setUsers(list);
  }, []);

  const filtered = useMemo(() => {
    let list = users;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    }
    if (filter !== "all") {
      if (filter === "New") {
        const weekAgo = Date.now() - 7 * 24 * 3600000;
        list = list.filter((u) => new Date(u.joined).getTime() > weekAgo);
      } else {
        list = list.filter((u) => {
          const status = suspendedIds.has(u.id) ? "Suspended" : u.status;
          return status === filter;
        });
      }
    }
    return list;
  }, [users, search, filter, suspendedIds]);

  const [sortKey, setSortKey] = useState<keyof AdminUser>("joined");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortedFiltered = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === "number" && typeof vb === "number") return sortDir === "asc" ? va - vb : vb - va;
      if (typeof va === "string" && typeof vb === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sortedFiltered.length / PER_PAGE) || 1;
  const currentPage = Math.min(page, totalPages - 1);
  const pageUsers = useMemo(
    () => sortedFiltered.slice(currentPage * PER_PAGE, (currentPage + 1) * PER_PAGE),
    [sortedFiltered, currentPage]
  );

  function toggleSort(key: keyof AdminUser) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else setSortKey(key);
  }

  function toggleSuspend(id: string) {
    setSuspendedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const stats = useMemo(() => {
    const active = users.filter((u) => !suspendedIds.has(u.id) && u.status !== "Suspended").length;
    const suspended = users.filter((u) => suspendedIds.has(u.id) || u.status === "Suspended").length;
    const weekAgo = Date.now() - 7 * 24 * 3600000;
    const newThisWeek = users.filter((u) => new Date(u.joined).getTime() > weekAgo).length;
    return { total: users.length, activeToday: 342, newThisWeek: newThisWeek || 89, suspended };
  }, [users, suspendedIds]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">User Management</h1>

      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/5 bg-admin-card p-4">
        <span className="text-admin-body">Total Users: <strong className="text-white">{stats.total}</strong></span>
        <span className="text-admin-body">Active Today: <strong className="text-admin-success">{stats.activeToday}</strong></span>
        <span className="text-admin-body">New This Week: <strong className="text-white">{stats.newThisWeek}</strong></span>
        <span className="text-admin-body">Suspended: <strong className="text-admin-danger">{stats.suspended}</strong></span>
      </div>

      <div className="flex flex-wrap gap-4">
        <input
          type="search"
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-admin-body focus:border-admin-accent focus:outline-none"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-admin-accent focus:outline-none"
        >
          <option value="all">All Users</option>
          <option value="Active">Active</option>
          <option value="Suspended">Suspended</option>
          <option value="New">New (7 days)</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/5 bg-admin-card">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-admin-body">
              {(["username", "email", "joined", "matches", "winRate", "balance", "totalWagered", "status"] as const).map((key) => (
                <th
                  key={key}
                  className="cursor-pointer px-4 py-3 font-medium hover:text-white"
                  onClick={() => toggleSort(key)}
                >
                  {key === "username" ? "Username" : key === "totalWagered" ? "Total Wagered" : key.charAt(0).toUpperCase() + key.slice(1)}
                  {sortKey === key && (sortDir === "asc" ? " ↑" : " ↓")}
                </th>
              ))}
              <th className="px-4 py-3 font-medium text-admin-body">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageUsers.map((u) => {
              const status = suspendedIds.has(u.id) ? "Suspended" : u.status;
              return (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 font-medium text-white">{u.username}</td>
                  <td className="px-4 py-3 text-admin-body">{u.email}</td>
                  <td className="px-4 py-3 text-admin-body">{u.joined}</td>
                  <td className="px-4 py-3 text-admin-body">{u.matches}</td>
                  <td className="px-4 py-3 text-admin-body">{u.winRate}%</td>
                  <td className="px-4 py-3 text-admin-body">${u.balance.toFixed(2)}</td>
                  <td className="px-4 py-3 text-admin-body">${u.totalWagered.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        status === "Active"
                          ? "bg-admin-success/20 text-admin-success"
                          : status === "Suspended"
                            ? "bg-admin-danger/20 text-admin-danger"
                            : "bg-admin-accent/20 text-admin-accent"
                      }`}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => alert(JSON.stringify(u, null, 2))}
                        className="rounded border border-white/10 px-2 py-1 text-xs text-admin-body hover:bg-white/10"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSuspend(u.id)}
                        className="rounded border border-admin-danger/50 px-2 py-1 text-xs text-admin-danger hover:bg-admin-danger/10"
                      >
                        {status === "Suspended" ? "Restore" : "Suspend"}
                      </button>
                      <button
                        type="button"
                        onClick={() => alert("Adjust balance: coming soon")}
                        className="rounded border border-white/10 px-2 py-1 text-xs text-admin-body hover:bg-white/10"
                      >
                        Adjust Balance
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-admin-body">
          Showing {currentPage * PER_PAGE + 1}-{Math.min((currentPage + 1) * PER_PAGE, filtered.length)} of {filtered.length}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border border-white/10 px-3 py-1 text-sm text-white disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-white/10 px-3 py-1 text-sm text-white disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
