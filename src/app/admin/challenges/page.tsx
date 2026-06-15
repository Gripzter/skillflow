"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminConfirmModal, {
  AdminPageHeader,
  AdminStatusBadge,
  AdminTableShell,
} from "@/components/admin/AdminShared";
import { adminFetch } from "@/lib/admin-client";

type ChallengeTemplate = {
  id: string;
  title: string;
  description: string | null;
  game: string;
  challenge_type: string;
  target_value: number;
  reward_sk: number;
  is_active: boolean;
  difficulty: string;
};

type TodaySlot = {
  id: string;
  slot: number;
  template: ChallengeTemplate;
  startedCount: number;
  completedCount: number;
};

type StatsRow = {
  title: string;
  timesShown: number;
  startedBy: number;
  completedBy: number;
  completionRate: number;
  skPaidOut: number;
};

const GAME_OPTIONS = [
  { value: "connect4", label: "Connect 4" },
  { value: "chess", label: "Chess" },
  { value: "reaction_duel", label: "Reaction Duel" },
  { value: "spelling_bee", label: "Spelling Bee" },
  { value: "memory_match", label: "Memory Match" },
  { value: "checkers", label: "Checkers" },
  { value: "any", label: "Any Game" },
];

const TYPE_OPTIONS = [
  { value: "play_matches", label: "Play N matches" },
  { value: "win_matches", label: "Win N matches" },
  { value: "win_streak", label: "Win N in a row" },
  { value: "play_minutes", label: "Play N minutes" },
  { value: "earn_sp", label: "Earn N SP" },
];

const DIFFICULTY_OPTIONS = ["easy", "normal", "hard"];

const EMPTY_FORM = {
  title: "",
  description: "",
  game: "any",
  challenge_type: "play_matches",
  target_value: 5,
  reward_sk: 100,
  difficulty: "normal",
  is_active: true,
};

function suggestDifficulty(target: number, reward: number): string {
  if (target <= 3 && reward <= 100) return "easy";
  if (target >= 8 || reward >= 300) return "hard";
  return "normal";
}

export default function AdminChallengesPage() {
  const [templates, setTemplates] = useState<ChallengeTemplate[]>([]);
  const [todaySlots, setTodaySlots] = useState<TodaySlot[]>([]);
  const [stats, setStats] = useState<StatsRow[]>([]);
  const [challengeDate, setChallengeDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [rotateConfirm, setRotateConfirm] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [main, statsRes] = await Promise.all([
        adminFetch<{ templates: ChallengeTemplate[]; todaySlots: TodaySlot[]; challengeDate: string }>(
          "/api/admin/challenges"
        ),
        adminFetch<{ stats: StatsRow[] }>("/api/admin/challenges/stats"),
      ]);
      setTemplates(main.templates);
      setTodaySlots(main.todaySlots);
      setChallengeDate(main.challengeDate);
      setStats(statsRes.stats);
    } catch (err) {
      console.error("[admin challenges]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const suggestedDifficulty = useMemo(
    () => suggestDifficulty(form.target_value, form.reward_sk),
    [form.target_value, form.reward_sk]
  );

  async function handleRotate() {
    setRotating(true);
    try {
      await adminFetch("/api/admin/challenges/rotate", { method: "POST" });
      setRotateConfirm(false);
      await load();
    } catch (err) {
      console.error("[rotate challenges]", err);
    } finally {
      setRotating(false);
    }
  }

  async function toggleActive(template: ChallengeTemplate) {
    try {
      await adminFetch("/api/admin/challenges", {
        method: "PATCH",
        body: JSON.stringify({ id: template.id, is_active: !template.is_active }),
      });
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, is_active: !t.is_active } : t))
      );
    } catch (err) {
      console.error("[toggle template]", err);
    }
  }

  function startEdit(template: ChallengeTemplate) {
    setEditingId(template.id);
    setShowForm(true);
    setForm({
      title: template.title,
      description: template.description ?? "",
      game: template.game,
      challenge_type: template.challenge_type,
      target_value: template.target_value,
      reward_sk: template.reward_sk,
      difficulty: template.difficulty,
      is_active: template.is_active,
    });
  }

  function startCreate() {
    setEditingId(null);
    setShowForm(true);
    setForm(EMPTY_FORM);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (form.target_value <= 0) return;
    if (form.reward_sk < 50 || form.reward_sk > 500) return;

    setSaving(true);
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        description: form.description.trim() || null,
        difficulty: form.difficulty || suggestedDifficulty,
      };

      if (editingId) {
        await adminFetch("/api/admin/challenges", {
          method: "PATCH",
          body: JSON.stringify({ id: editingId, ...payload }),
        });
      } else {
        await adminFetch("/api/admin/challenges", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      console.error("[save template]", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await adminFetch(`/api/admin/challenges?id=${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      await load();
    } catch (err) {
      console.error("[delete template]", err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8 pb-12">
      <AdminPageHeader
        title="daily challenges"
        subtitle="Manage challenge templates, today's rotation, and completion stats."
      />

      {/* Section 1 — Today's active */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold lowercase text-white">today&apos;s active challenges</h2>
            <p className="text-xs text-[#9CA3AF]">UTC date: {challengeDate || "—"}</p>
          </div>
          <button
            type="button"
            onClick={() => setRotateConfirm(true)}
            className="rounded-lg bg-[#FFFF00] px-4 py-2 text-sm font-medium lowercase text-black hover:opacity-90"
          >
            force rotate today&apos;s challenges
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-[#9CA3AF]">loading…</p>
        ) : todaySlots.length === 0 ? (
          <p className="text-sm text-[#9CA3AF]">No slots for today yet — rotation runs on first player load.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {todaySlots.map((slot) => (
              <div
                key={slot.id}
                className="rounded-xl border border-white/10 bg-[#16161C] p-4"
              >
                <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF]">slot {slot.slot}</p>
                <p className="mt-1 text-sm font-medium text-white">{slot.template?.title}</p>
                <p className="mt-1 text-xs text-[#9CA3AF]">
                  {slot.template?.game} · +{slot.template?.reward_sk} SK
                </p>
                <div className="mt-3 flex gap-4 text-xs text-[#C8C8D4]">
                  <span>{slot.startedCount} started</span>
                  <span>{slot.completedCount} completed</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 2 — Template library */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold lowercase text-white">challenge template library</h2>
          <button
            type="button"
            onClick={startCreate}
            className="rounded-lg border border-[#FFFF00] px-4 py-2 text-sm lowercase text-[#FFFF00] hover:bg-[#FFFF00]/10"
          >
            + new challenge
          </button>
        </div>

        {showForm ? (
          <form
            onSubmit={(e) => void handleSave(e)}
            className="rounded-xl border border-white/10 bg-[#16161C] p-5 space-y-4"
          >
            <h3 className="text-sm font-medium text-white lowercase">
              {editingId ? "edit challenge" : "new challenge"}
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-xs text-[#9CA3AF]">
                title
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-[#9CA3AF]">
                game
                <select
                  value={form.game}
                  onChange={(e) => setForm((f) => ({ ...f, game: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                >
                  {GAME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-[#9CA3AF] md:col-span-2">
                description (optional)
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-[#9CA3AF]">
                challenge type
                <select
                  value={form.challenge_type}
                  onChange={(e) => setForm((f) => ({ ...f, challenge_type: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-[#9CA3AF]">
                target value
                <input
                  type="number"
                  min={1}
                  required
                  value={form.target_value}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, target_value: Number(e.target.value) }))
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-[#9CA3AF]">
                reward SK (50–500)
                <input
                  type="number"
                  min={50}
                  max={500}
                  required
                  value={form.reward_sk}
                  onChange={(e) => setForm((f) => ({ ...f, reward_sk: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-[#9CA3AF]">
                difficulty
                <select
                  value={form.difficulty}
                  onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                >
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} {d === suggestedDifficulty ? "(suggested)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-[#9CA3AF] pt-6">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                active
              </label>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#FFFF00] px-4 py-2 text-sm font-medium lowercase text-black disabled:opacity-50"
              >
                {saving ? "saving…" : "save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm lowercase text-[#9CA3AF]"
              >
                cancel
              </button>
            </div>
          </form>
        ) : null}

        <AdminTableShell>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs lowercase text-[#9CA3AF]">
                <th className="px-4 py-3">title</th>
                <th className="px-4 py-3">game</th>
                <th className="px-4 py-3">type</th>
                <th className="px-4 py-3">target</th>
                <th className="px-4 py-3">reward SK</th>
                <th className="px-4 py-3">difficulty</th>
                <th className="px-4 py-3">active</th>
                <th className="px-4 py-3">actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="max-w-[220px] px-4 py-3 text-white whitespace-normal break-words">
                    {t.title}
                  </td>
                  <td className="px-4 py-3 text-[#C8C8D4]">{t.game}</td>
                  <td className="px-4 py-3 text-[#C8C8D4]">{t.challenge_type}</td>
                  <td className="px-4 py-3 text-[#C8C8D4]">{t.target_value}</td>
                  <td className="px-4 py-3 text-[#FFFF00]">{t.reward_sk}</td>
                  <td className="px-4 py-3">
                    <AdminStatusBadge status={t.difficulty} />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void toggleActive(t)}
                      className={`rounded px-2 py-0.5 text-xs ${t.is_active ? "bg-green-500/20 text-green-400" : "bg-white/10 text-[#9CA3AF]"}`}
                    >
                      {t.is_active ? "active" : "inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(t)}
                        className="text-xs text-[#FFFF00] hover:underline"
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(t.id)}
                        className="text-xs text-red-400 hover:underline"
                      >
                        delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableShell>
      </section>

      {/* Section 3 — Stats */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold lowercase text-white">challenge stats (last 7 days)</h2>
        <AdminTableShell>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs lowercase text-[#9CA3AF]">
                <th className="px-4 py-3">challenge title</th>
                <th className="px-4 py-3">times shown</th>
                <th className="px-4 py-3">started by</th>
                <th className="px-4 py-3">completed by</th>
                <th className="px-4 py-3">completion rate</th>
                <th className="px-4 py-3">SK paid out</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={row.title} className="border-b border-white/5">
                  <td className="px-4 py-3 text-white">{row.title}</td>
                  <td className="px-4 py-3 text-[#C8C8D4]">{row.timesShown}</td>
                  <td className="px-4 py-3 text-[#C8C8D4]">{row.startedBy}</td>
                  <td className="px-4 py-3 text-[#C8C8D4]">{row.completedBy}</td>
                  <td className="px-4 py-3 text-[#C8C8D4]">{row.completionRate}%</td>
                  <td className="px-4 py-3 text-[#FFFF00]">{row.skPaidOut.toLocaleString()} SK</td>
                </tr>
              ))}
              {stats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-[#9CA3AF]">
                    No stats yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </AdminTableShell>
      </section>

      <AdminConfirmModal
        open={rotateConfirm}
        title="force rotate today's challenges?"
        message="This clears today's slots and randomly selects 3 new active templates. All players will see the new set immediately."
        confirmLabel="rotate"
        confirmTone="warning"
        loading={rotating}
        onConfirm={() => void handleRotate()}
        onCancel={() => setRotateConfirm(false)}
      />

      <AdminConfirmModal
        open={deleteId != null}
        title="delete challenge template?"
        message="This permanently removes the template. Existing daily slots referencing it may be affected."
        confirmLabel="delete"
        confirmTone="danger"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
