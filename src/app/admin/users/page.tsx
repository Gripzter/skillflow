"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import LoadingRing from "@/components/LoadingRing";

interface AdminUser {
  id: string;
  email: string;
  username: string;
  balance: number;
  total_deposited: number;
  total_withdrawn: number;
  total_matches: number;
  total_wins: number;
  total_earnings: number;
  created_at: string;
  last_sign_in_at?: string;
}

type SortKey = keyof Pick<AdminUser, "username" | "email" | "balance" | "total_matches" | "total_earnings" | "created_at">;

const PER_PAGE = 20;

function winRate(u: AdminUser): number {
  if (!u.total_matches) return 0;
  return Math.round((u.total_wins / u.total_matches) * 1000) / 10;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) {
        setError("Supabase not configured.");
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (token) {
        // Try service-role API for emails
        try {
          const res = await fetch("/api/admin/users", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setUsers(data);
            setLoading(false);
            return;
          }
        } catch {
          // Fall through to profile-only query
        }
      }

      // Fallback: query profiles + wallets without email
      const [{ data: profiles }, { data: wallets }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, username, total_matches, total_wins, total_earnings, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("wallets").select("user_id, balance, total_deposited, total_withdrawn"),
      ]);

      const walletMap = new Map(wallets?.map((w) => [w.user_id, w]) ?? []);

      const merged: AdminUser[] = (profiles ?? []).map((p) => {
        const w = walletMap.get(p.id);
        return {
          id: p.id,
          email: "—",
          username: p.username,
          balance: w?.balance ?? 0,
          total_deposited: w?.total_deposited ?? 0,
          total_withdrawn: w?.total_withdrawn ?? 0,
          total_matches: p.total_matches ?? 0,
          total_wins: p.total_wins ?? 0,
          total_earnings: p.total_earnings ?? 0,
          created_at: p.created_at,
        };
      });

      setUsers(merged);
      if (!token) setError("Add SUPABASE_SERVICE_ROLE_KEY to .env.local to see emails.");
      setLoading(false);
    }
    load();
  }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
    setPage(0);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        !q ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
    );
  }, [users, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey];
      const dir = sortDir === "asc" ? 1 : -1;
      if (typeof va === "number" && typeof vb === "number") return dir * (va - vb);
      return dir * String(va).localeCompare(String(vb));
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const curPage = Math.min(page, totalPages - 1);
  const pageUsers = sorted.slice(curPage * PER_PAGE, (curPage + 1) * PER_PAGE);

  function SortTh({ k, label }: { k: SortKey; label: string }) {
    return (
      <th
        className="cursor-pointer whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-[#9CA3AF] hover:text-white"
        onClick={() => toggleSort(k)}
      >
        {label}
        {sortKey === k && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </th>
    );
  }

  if (loading) {
    return <LoadingRing />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Users</h1>
        <div className="flex items-center gap-3 text-sm text-[#9CA3AF]">
          <span>{users.length.toLocaleString()} total</span>
          {error && (
            <span className="rounded bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-400">
              {error}
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Search by username, email, or ID…"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        className="w-full max-w-sm rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-[#6B7280] focus:border-[#FF5E00] focus:outline-none"
      />

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/5 bg-admin-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-white/5">
              <SortTh k="username" label="Username" />
              <SortTh k="email" label="Email" />
              <SortTh k="balance" label="Balance" />
              <SortTh k="total_matches" label="Matches" />
              <th className="px-4 py-3 text-left text-xs font-medium text-[#9CA3AF]">Win Rate</th>
              <SortTh k="total_earnings" label="Earnings" />
              <SortTh k="created_at" label="Signed Up" />
            </tr>
          </thead>
          <tbody>
            {pageUsers.map((u) => (
              <>
                <tr
                  key={u.id}
                  className="cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/[0.03]"
                  onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}
                >
                  <td className="px-4 py-3 font-medium text-white">{u.username}</td>
                  <td className="px-4 py-3 text-[#9CA3AF]">{u.email}</td>
                  <td className="px-4 py-3 text-[#9CA3AF]">
                    ${u.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-[#9CA3AF]">{u.total_matches}</td>
                  <td className="px-4 py-3 text-[#9CA3AF]">{winRate(u)}%</td>
                  <td className="px-4 py-3 text-admin-success">
                    ${u.total_earnings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-[#9CA3AF]">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
                {expandedId === u.id && (
                  <tr key={`${u.id}-exp`} className="border-b border-white/10 bg-white/[0.02]">
                    <td colSpan={7} className="px-6 py-4">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-xs text-[#6B7280]">User ID</p>
                          <p className="mt-0.5 font-mono text-xs text-white">{u.id}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6B7280]">Total Deposited</p>
                          <p className="mt-0.5 text-sm text-white">
                            ${u.total_deposited.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6B7280]">Total Withdrawn</p>
                          <p className="mt-0.5 text-sm text-white">
                            ${u.total_withdrawn.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6B7280]">Last Sign In</p>
                          <p className="mt-0.5 text-sm text-white">
                            {u.last_sign_in_at
                              ? new Date(u.last_sign_in_at).toLocaleString()
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {pageUsers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#9CA3AF]">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-[#9CA3AF]">
        <span>
          {sorted.length === 0
            ? "No results"
            : `${curPage * PER_PAGE + 1}–${Math.min((curPage + 1) * PER_PAGE, sorted.length)} of ${sorted.length}`}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={curPage === 0}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border border-white/10 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-30 hover:bg-white/5"
          >
            ← Prev
          </button>
          <button
            type="button"
            disabled={curPage >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-white/10 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-30 hover:bg-white/5"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
