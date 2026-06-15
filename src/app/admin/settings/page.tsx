"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminPageHeader,
  AdminTableShell,
  RelativeTime,
  TypedConfirmModal,
} from "@/components/admin/AdminShared";
import { adminFetch } from "@/lib/admin-client";

type SettingsData = {
  settings: Record<string, string>;
  changeLog: Array<{
    id: string;
    setting_key: string;
    old_value: string | null;
    new_value: string;
    created_at: string;
    updated_by: string | null;
  }>;
  adminSessions: Array<{
    id: string;
    admin_id: string;
    created_at: string;
    ended_at: string | null;
  }>;
};

const SETTING_FIELDS: Array<{ key: string; label: string; type?: "number" | "text" }> = [
  { key: "min_deposit_usd", label: "min deposit (usd)", type: "number" },
  { key: "min_withdrawal_usd", label: "min withdrawal (usd)", type: "number" },
  { key: "max_entry_sk", label: "max entry (sk)", type: "number" },
  { key: "default_creator_share", label: "default creator share (0–1)", type: "number" },
  { key: "match_timeout_minutes", label: "match timeout (minutes)", type: "number" },
  { key: "auto_void_minutes", label: "auto void (minutes)", type: "number" },
  { key: "fixed_costs_usd", label: "fixed costs (usd/month)", type: "number" },
];

export default function AdminSettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [maintenanceConfirm, setMaintenanceConfirm] = useState(false);
  const [killSessionsConfirm, setKillSessionsConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch<SettingsData>("/api/admin/settings");
      setData(res);
      setForm(res.settings);
    } catch (err) {
      console.error("[admin settings]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSetting(key: string, value: string) {
    await adminFetch("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({ key, value }),
    });
  }

  async function handleSaveForm(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    try {
      for (const { key } of SETTING_FIELDS) {
        if (form[key] !== undefined && form[key] !== data?.settings[key]) {
          await saveSetting(key, form[key]);
        }
      }
      setSavedMsg("settings saved");
      void load();
    } catch (err) {
      console.error("[save settings]", err);
    } finally {
      setSaving(false);
    }
  }

  async function toggleMaintenance() {
    setActionLoading(true);
    const current = form.maintenance_mode === "true";
    const next = current ? "false" : "true";
    try {
      await saveSetting("maintenance_mode", next);
      setForm((f) => ({ ...f, maintenance_mode: next }));
      setMaintenanceConfirm(false);
      void load();
    } catch (err) {
      console.error("[maintenance]", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function killSessions() {
    setActionLoading(true);
    try {
      await adminFetch("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ action: "kill_sessions" }),
      });
      setKillSessionsConfirm(false);
      void load();
    } catch (err) {
      console.error("[kill sessions]", err);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#333] border-t-[#FFFF00]" />
      </div>
    );
  }

  const maintenanceOn = form.maintenance_mode === "true";

  return (
    <div className="space-y-8">
      <AdminPageHeader title="settings" subtitle="platform configuration" />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setMaintenanceConfirm(true)}
          className={`rounded-lg border px-4 py-2 text-sm lowercase ${
            maintenanceOn
              ? "border-orange-500/40 bg-orange-500/10 text-orange-400"
              : "border-white/10 text-[#C8C8D4] hover:bg-white/5"
          }`}
        >
          {maintenanceOn ? "maintenance mode on — change" : "maintenance mode off — enable"}
        </button>
        <button
          type="button"
          onClick={() => setKillSessionsConfirm(true)}
          className="rounded-lg border border-red-500/30 px-4 py-2 text-sm lowercase text-red-400 hover:bg-red-500/10"
        >
          kill all admin sessions
        </button>
      </div>

      <form
        onSubmit={(e) => void handleSaveForm(e)}
        className="rounded-xl border border-white/5 bg-[#1A1A1F] p-6"
      >
        <h2 className="mb-4 text-sm font-medium lowercase text-[#C8C8D4]">platform settings</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {SETTING_FIELDS.map(({ key, label, type }) => (
            <div key={key}>
              <label className="mb-1 block text-xs lowercase text-[#7A7A8E]">{label}</label>
              <input
                type={type ?? "text"}
                step={type === "number" ? "any" : undefined}
                value={form[key] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-[#0E0E12] px-3 py-2 text-sm text-white"
              />
            </div>
          ))}
        </div>
        {savedMsg ? <p className="mt-3 text-sm text-emerald-400">{savedMsg}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="mt-4 rounded-lg bg-[#FFFF00] px-5 py-2 text-sm font-medium lowercase text-black hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "saving…" : "save settings"}
        </button>
      </form>

      <div>
        <h2 className="mb-3 text-sm font-medium lowercase text-[#C8C8D4]">change log</h2>
        <AdminTableShell>
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                <th className="px-4 py-3">setting</th>
                <th className="px-4 py-3">old</th>
                <th className="px-4 py-3">new</th>
                <th className="px-4 py-3">when</th>
              </tr>
            </thead>
            <tbody>
              {(data?.changeLog ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[#7A7A8E]">
                    no changes logged
                  </td>
                </tr>
              ) : (
                data!.changeLog.map((log, i) => (
                  <tr key={log.id} className={i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"}>
                    <td className="px-4 py-3 text-white">{log.setting_key}</td>
                    <td className="px-4 py-3 text-[#7A7A8E]">{log.old_value ?? "—"}</td>
                    <td className="px-4 py-3 text-[#FFFF00]">{log.new_value}</td>
                    <td className="px-4 py-3 text-[#7A7A8E]">
                      <RelativeTime iso={log.created_at} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </AdminTableShell>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium lowercase text-[#C8C8D4]">admin sessions</h2>
        <AdminTableShell>
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs lowercase text-[#7A7A8E]">
                <th className="px-4 py-3">admin</th>
                <th className="px-4 py-3">started</th>
                <th className="px-4 py-3">status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.adminSessions ?? []).map((s, i) => (
                <tr key={s.id} className={i % 2 === 0 ? "bg-[#1A1A1F]" : "bg-[#0E0E12]"}>
                  <td className="px-4 py-3 font-mono text-xs text-[#C8C8D4]">{s.admin_id}</td>
                  <td className="px-4 py-3 text-[#7A7A8E]">
                    <RelativeTime iso={s.created_at} />
                  </td>
                  <td className="px-4 py-3 text-xs lowercase">
                    {s.ended_at ? (
                      <span className="text-[#7A7A8E]">ended</span>
                    ) : (
                      <span className="text-emerald-400">active</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableShell>
      </div>

      <TypedConfirmModal
        open={maintenanceConfirm}
        title={maintenanceOn ? "disable maintenance mode" : "enable maintenance mode"}
        message={
          maintenanceOn
            ? "players will be able to access the platform again."
            : "this will block player access until maintenance mode is turned off."
        }
        confirmText={maintenanceOn ? "disable maintenance" : "enable maintenance"}
        typedValue={maintenanceOn ? "disable" : "maintenance"}
        loading={actionLoading}
        onConfirm={() => void toggleMaintenance()}
        onCancel={() => setMaintenanceConfirm(false)}
      />

      <TypedConfirmModal
        open={killSessionsConfirm}
        title="kill all admin sessions"
        message="this will end every active admin session. all admins will need to sign in again."
        confirmText="kill sessions"
        typedValue="kill sessions"
        loading={actionLoading}
        onConfirm={() => void killSessions()}
        onCancel={() => setKillSessionsConfirm(false)}
      />
    </div>
  );
}
