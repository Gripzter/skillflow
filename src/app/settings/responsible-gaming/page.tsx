"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import LoadingRing from "@/components/LoadingRing";
import { useToast } from "@/components/Toast";
import { createClient } from "@/lib/supabase";
import { getUserFriendlyError } from "@/lib/errorHandler";
import { applyPendingLimitChanges, type ResponsibleGamingRow } from "@/lib/responsible-gaming";
import { signOutAndRedirect } from "@/lib/client-session";

const DAILY_OPTS = [null, 10, 25, 50, 100, 250] as const;
const WEEKLY_OPTS = [null, 50, 100, 250, 500] as const;
const MONTHLY_OPTS = [null, 100, 250, 500, 1000] as const;
const SELF_EXCLUSION_OPTIONS = [
  { label: "6 months", months: 6, type: "6_months" },
  { label: "1 year", months: 12, type: "1_year" },
  { label: "Permanent", months: null, type: "permanent" },
] as const;

const HELPLINE = "1-800-522-4700";
const HELPLINE_CHAT = "https://ncpgambling.org/chat";

export default function SettingsResponsibleGamingPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [rg, setRg] = useState<ResponsibleGamingRow | null>(null);
  const [pending, setPending] = useState<{ limit_type: string; new_value: number | null; effective_at: string }[]>([]);
  const [stats, setStats] = useState<{
    depositedThisMonth: number;
    wageredThisMonth: number;
    netThisMonth: number;
    matchesThisMonth: number;
    biggestLoss: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [coolOffModal, setCoolOffModal] = useState<number | null>(null);
  const [selfExcludeModal, setSelfExcludeModal] = useState<typeof SELF_EXCLUSION_OPTIONS[number] | null>(null);
  const [customDaily, setCustomDaily] = useState("");
  const [customWeekly, setCustomWeekly] = useState("");
  const [customMonthly, setCustomMonthly] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        router.push("/login");
        return;
      }
      setUser({ id: u.id, username: (u.user_metadata?.username as string) ?? "Player" });
      await applyPendingLimitChanges(supabase, u.id);
      const { data: rgData } = await supabase
        .from("responsible_gaming")
        .select("*")
        .eq("user_id", u.id)
        .single();
      setRg(rgData ?? null);
      const { data: pendingData } = await supabase
        .from("pending_limit_changes")
        .select("limit_type, new_value, effective_at")
        .eq("user_id", u.id);
      setPending(pendingData ?? []);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: txs } = await supabase
        .from("transactions")
        .select("type, amount, created_at")
        .eq("user_id", u.id)
        .gte("created_at", monthStart);
      let depositedThisMonth = 0;
      let wageredThisMonth = 0;
      let netThisMonth = 0;
      (txs ?? []).forEach((t) => {
        const amt = Number(t.amount);
        if (t.type === "deposit") depositedThisMonth += amt;
        if (t.type === "match_entry") {
          wageredThisMonth += amt;
          netThisMonth -= amt;
        }
        if (t.type === "match_win") netThisMonth += amt;
        if (t.type === "match_refund") netThisMonth += amt;
      });
      const { data: matches } = await supabase
        .from("matches")
        .select("stake_amount, result, player1_id")
        .or(`player1_id.eq.${u.id},player2_id.eq.${u.id}`)
        .eq("status", "completed")
        .gte("created_at", monthStart);
      let matchesThisMonth = matches?.length ?? 0;
      let biggestLoss = 0;
      (matches ?? []).forEach((m) => {
        const stake = Number(m.stake_amount);
        const isPlayer1 = m.player1_id === u.id;
        const lost = (m.result === "player2_win" && isPlayer1) || (m.result === "player1_win" && !isPlayer1);
        if (lost && stake > biggestLoss) biggestLoss = stake;
      });
      setStats({
        depositedThisMonth,
        wageredThisMonth,
        netThisMonth,
        matchesThisMonth,
        biggestLoss,
      });
      setLoading(false);
    }
    load();
  }, [router]);

  async function updateLimit(type: "daily" | "weekly" | "monthly", newLimit: number | null) {
    if (!user || !rg) return;
    const supabase = createClient();
    if (!supabase) return;
    setSaving(type);
    const currentLimit =
      type === "daily"
        ? rg.daily_deposit_limit != null ? Number(rg.daily_deposit_limit) : null
        : type === "weekly"
          ? rg.weekly_deposit_limit != null ? Number(rg.weekly_deposit_limit) : null
          : rg.monthly_deposit_limit != null ? Number(rg.monthly_deposit_limit) : null;

    const isIncrease = newLimit === null || (currentLimit !== null && newLimit > currentLimit);
    const isRemoval = newLimit === null && currentLimit !== null;

    if (isIncrease || isRemoval) {
      const coolOffHours = isRemoval ? 72 : 24;
      const effectiveAt = new Date(Date.now() + coolOffHours * 60 * 60 * 1000).toISOString();
      await supabase.from("pending_limit_changes").upsert(
        { user_id: user.id, limit_type: type, new_value: newLimit, effective_at: effectiveAt },
        { onConflict: "user_id,limit_type" }
      );
      showToast(
        `Your new ${type} limit will take effect in ${coolOffHours} hours.`,
        "success"
      );
      setPending((prev) => {
        const rest = prev.filter((p) => p.limit_type !== type);
        return [...rest, { limit_type: type, new_value: newLimit, effective_at: effectiveAt }];
      });
    } else {
      const { error } = await supabase
        .from("responsible_gaming")
        .upsert(
          {
            user_id: user.id,
            [`${type}_deposit_limit`]: newLimit,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();
      if (error) {
        showToast(getUserFriendlyError(error), "error");
      } else {
        showToast("Limit updated immediately.", "success");
        setRg((prev) =>
          prev ? { ...prev, [`${type}_deposit_limit`]: newLimit } : null
        );
        setPending((prev) => prev.filter((p) => p.limit_type !== type));
      }
    }
    setSaving(null);
  }

  async function startCoolOff(hours: number) {
    if (!user) return;
    const supabase = createClient();
    if (!supabase) return;
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("responsible_gaming")
      .upsert(
        { user_id: user.id, cool_off_until: until, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    if (error) showToast(getUserFriendlyError(error), "error");
    else {
      showToast("Cool-off period started. Real money play is disabled.", "success");
      setRg((prev) => (prev ? { ...prev, cool_off_until: until } : null));
    }
    setCoolOffModal(null);
  }

  async function confirmSelfExclude(option: typeof SELF_EXCLUSION_OPTIONS[number]) {
    if (!user) return;
    const supabase = createClient();
    if (!supabase) return;
    const until =
      option.months === null ? null : new Date(Date.now() + option.months * 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("responsible_gaming")
      .upsert(
        {
          user_id: user.id,
          self_excluded: true,
          self_exclusion_until: until,
          self_exclusion_type: option.type,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (error) {
      showToast(getUserFriendlyError(error), "error");
      setSelfExcludeModal(null);
      return;
    }
    showToast("You have been self-excluded. Logging out.", "success");
    await signOutAndRedirect("/login?self_excluded=1");
    setSelfExcludeModal(null);
  }

  if (loading) {
    return <LoadingRing />;
  }

  const dailyLimit = rg?.daily_deposit_limit != null ? Number(rg.daily_deposit_limit) : null;
  const weeklyLimit = rg?.weekly_deposit_limit != null ? Number(rg.weekly_deposit_limit) : null;
  const monthlyLimit = rg?.monthly_deposit_limit != null ? Number(rg.monthly_deposit_limit) : null;
  const dailyUsed = Number(rg?.daily_deposited ?? 0);
  const weeklyUsed = Number(rg?.weekly_deposited ?? 0);
  const monthlyUsed = Number(rg?.monthly_deposited ?? 0);
  const coolOffUntil = rg?.cool_off_until ? new Date(rg.cool_off_until) : null;
  const inCoolOff = coolOffUntil && coolOffUntil > new Date();

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username={user?.username ?? "Player"}
        isDevMode={false}
        onLogout={async () => {}}
        loggingOut={false}
        currentPage="settings"
      />
      <main className="relative mx-auto max-w-[800px] px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-body-gray transition-colors hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Settings
        </Link>
        <h1 className="mt-6 text-2xl font-bold text-white"> Responsible Gaming</h1>
        <p className="mt-1 text-body-gray">Set personal limits to stay in control of your gaming.</p>

        <p className="mt-4 text-sm text-amber-200/90">
          Limits can be lowered instantly. Increases take 24 hours and removing a limit takes 72 hours to protect you.
        </p>

        {/* Section A: Deposit limits */}
        <section className="mt-8 rounded-xl border border-white/10 bg-card p-6">
          <h2 className="text-lg font-semibold text-white">Deposit Limits</h2>
          <div className="mt-4 space-y-6">
            <div>
              <p className="text-sm text-body-gray">Daily</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {DAILY_OPTS.map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    disabled={!!saving}
                    onClick={() => updateLimit("daily", v)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      dailyLimit === v
                        ? "border-teal bg-teal text-charcoal"
                        : "border-white/20 bg-white/5 text-white hover:border-white/40"
                    }`}
                  >
                    {v == null ? "No limit" : `$${v}`}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  placeholder="Custom"
                  value={customDaily}
                  onChange={(e) => setCustomDaily(e.target.value)}
                  onBlur={() => {
                    const n = parseFloat(customDaily);
                    if (!Number.isNaN(n) && n > 0) updateLimit("daily", n);
                  }}
                  className="w-20 rounded border border-white/20 bg-[#1A1D27] px-2 py-1.5 text-sm text-white"
                />
              </div>
              {dailyLimit != null && (
                <p className="mt-2 text-xs text-body-gray">
                  Today: ${dailyUsed} / ${dailyLimit} limit
                </p>
              )}
              {pending.find((p) => p.limit_type === "daily") && (
                <p className="mt-1 text-xs text-amber-400">Pending change will apply at the time shown.</p>
              )}
            </div>
            <div>
              <p className="text-sm text-body-gray">Weekly</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {WEEKLY_OPTS.map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    disabled={!!saving}
                    onClick={() => updateLimit("weekly", v)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      weeklyLimit === v
                        ? "border-teal bg-teal text-charcoal"
                        : "border-white/20 bg-white/5 text-white hover:border-white/40"
                    }`}
                  >
                    {v == null ? "No limit" : `$${v}`}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  placeholder="Custom"
                  value={customWeekly}
                  onChange={(e) => setCustomWeekly(e.target.value)}
                  onBlur={() => {
                    const n = parseFloat(customWeekly);
                    if (!Number.isNaN(n) && n > 0) updateLimit("weekly", n);
                  }}
                  className="w-20 rounded border border-white/20 bg-[#1A1D27] px-2 py-1.5 text-sm text-white"
                />
              </div>
              {weeklyLimit != null && (
                <p className="mt-2 text-xs text-body-gray">
                  This week: ${weeklyUsed} / ${weeklyLimit} limit
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-body-gray">Monthly</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {MONTHLY_OPTS.map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    disabled={!!saving}
                    onClick={() => updateLimit("monthly", v)}
                    className={`rounded-full border px-3 py-1.5 text-sm ${
                      monthlyLimit === v
                        ? "border-teal bg-teal text-charcoal"
                        : "border-white/20 bg-white/5 text-white hover:border-white/40"
                    }`}
                  >
                    {v == null ? "No limit" : `$${v}`}
                  </button>
                ))}
                <input
                  type="number"
                  min={1}
                  placeholder="Custom"
                  value={customMonthly}
                  onChange={(e) => setCustomMonthly(e.target.value)}
                  onBlur={() => {
                    const n = parseFloat(customMonthly);
                    if (!Number.isNaN(n) && n > 0) updateLimit("monthly", n);
                  }}
                  className="w-20 rounded border border-white/20 bg-[#1A1D27] px-2 py-1.5 text-sm text-white"
                />
              </div>
              {monthlyLimit != null && (
                <p className="mt-2 text-xs text-body-gray">
                  This month: ${monthlyUsed} / ${monthlyLimit} limit
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Section B: Cool-off */}
        <section className="mt-8 rounded-xl border border-white/10 bg-card p-6">
          <h2 className="text-lg font-semibold text-white">Cool-off Period</h2>
          <p className="mt-1 text-sm text-body-gray">A temporary break from real money play. Practice mode stays available.</p>
          {inCoolOff && coolOffUntil && (
            <p className="mt-3 text-amber-300">
              ⏸ Cool-off active until {coolOffUntil.toLocaleString()}. Cannot be reversed early.
            </p>
          )}
          {!inCoolOff && (
            <div className="mt-4 flex flex-wrap gap-2">
              {([24, 48, 7 * 24, 30 * 24] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setCoolOffModal(h)}
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
                >
                  {h === 24 ? "24 hours" : h === 48 ? "48 hours" : h === 7 * 24 ? "7 days" : "30 days"}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Section C: Self-exclusion */}
        <section className="mt-8 rounded-xl border border-red-500/20 bg-red-500/5 p-6">
          <h2 className="text-lg font-semibold text-white">Self-Exclusion</h2>
          <p className="mt-1 text-sm text-body-gray">Complete block from the platform. Cannot be reversed early.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {SELF_EXCLUSION_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => setSelfExcludeModal(opt)}
                className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-500/20"
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm text-body-gray">
             National Problem Gambling Helpline: <a href={`tel:${HELPLINE.replace(/-/g, "")}`} className="text-teal hover:underline">{HELPLINE}</a>
            {" "}• <a href={HELPLINE_CHAT} target="_blank" rel="noopener noreferrer" className="text-teal hover:underline">Chat</a>
          </p>
        </section>

        {/* Section D: Gaming history */}
        {stats && (
          <section className="mt-8 rounded-xl border border-white/10 bg-card p-6">
            <h2 className="text-lg font-semibold text-white">Gaming History (this month)</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-body-gray">Deposited</p>
                <p className="text-lg font-semibold text-white">${stats.depositedThisMonth.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-body-gray">Wagered</p>
                <p className="text-lg font-semibold text-white">${stats.wageredThisMonth.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-body-gray">Net result</p>
                <p className={`text-lg font-semibold ${stats.netThisMonth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {stats.netThisMonth >= 0 ? "+" : ""}${stats.netThisMonth.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-body-gray">Matches played</p>
                <p className="text-lg font-semibold text-white">{stats.matchesThisMonth}</p>
              </div>
              <div>
                <p className="text-xs text-body-gray">Biggest single loss</p>
                <p className="text-lg font-semibold text-white">${stats.biggestLoss.toFixed(2)}</p>
              </div>
            </div>
          </section>
        )}

        <div className="mt-8">
          <Link href="/responsible-gaming" className="text-sm text-teal hover:underline">
            Learn more on our Responsible Gaming page →
          </Link>
        </div>
      </main>

      {/* Cool-off confirmation modal */}
      {coolOffModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-card p-6">
            <h3 className="text-lg font-bold text-white">Confirm cool-off</h3>
            <p className="mt-2 text-body-gray">
              Are you sure you want to take a {coolOffModal === 24 ? "24-hour" : coolOffModal === 48 ? "48-hour" : coolOffModal === 7 * 24 ? "7-day" : "30-day"} break?
              During this time you will NOT be able to: play matches for real money; make deposits. You CAN still use Practice Mode. This CANNOT be reversed early.
            </p>
            <p className="mt-3 text-sm text-amber-300"> Need help? {HELPLINE}</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => startCoolOff(coolOffModal)}
                className="flex-1 rounded-lg bg-amber-500 py-2.5 font-semibold text-charcoal"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setCoolOffModal(null)}
                className="flex-1 rounded-lg border border-white/20 py-2.5 text-white hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Self-exclusion confirmation modal */}
      {selfExcludeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-red-500/30 bg-card p-6">
            <h3 className="text-lg font-bold text-red-300"> Self-Exclusion</h3>
            <p className="mt-2 text-sm text-white">
              Self-exclusion is a serious step. During this period:
            </p>
            <ul className="mt-2 list-inside list-disc text-sm text-body-gray">
              <li>Your account will be completely locked</li>
              <li>You cannot play ANY games (including practice)</li>
              <li>You cannot deposit or withdraw</li>
              <li>You cannot log in</li>
              <li>This CANNOT be reversed until the period ends</li>
              {selfExcludeModal.type === "permanent" && (
                <li>Permanent exclusion can NEVER be reversed</li>
              )}
            </ul>
            <p className="mt-4 text-sm font-medium text-white">
              If you are struggling with gaming addiction, please contact:
            </p>
            <p className="mt-2 text-lg font-bold text-teal"> {HELPLINE}</p>
            <p className="text-sm text-body-gray"> Chat: ncpgambling.org/chat •  Text: {HELPLINE}</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => confirmSelfExclude(selfExcludeModal)}
                className="flex-1 rounded-lg bg-red-600 py-2.5 font-semibold text-white hover:bg-red-500"
              >
                I understand — Self-Exclude
              </button>
              <button
                type="button"
                onClick={() => setSelfExcludeModal(null)}
                className="flex-1 rounded-lg border border-white/20 py-2.5 text-white hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
