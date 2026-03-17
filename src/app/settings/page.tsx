"use client";

import Link from "next/link";
import AppNavbar from "@/components/AppNavbar";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { usePlayMode } from "@/contexts/PlayModeContext";

export default function SettingsPage() {
  const router = useRouter();
  const { isPractice } = usePlayMode();
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernamePassword, setUsernamePassword] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [passwordNew, setPasswordNew] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (typeof window !== "undefined" && localStorage.getItem("skillflow_dev_mode") === "true") {
        try {
          const raw = localStorage.getItem("skillflow_dev_user");
          if (raw) {
            const dev = JSON.parse(raw) as { username: string };
            setUser({ user_metadata: { username: dev.username } });
            setLoading(false);
            return;
          }
        } catch {
          // fall through
        }
      }
      const supabase = createClient();
      if (!supabase) {
        setLoading(false);
        router.push("/login");
        return;
      }
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        router.push("/login");
        return;
      }
      setUser(u);
      setLoading(false);
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <svg
          className={`h-10 w-10 animate-spin ${isPractice ? "text-purple-400" : "text-teal"}`}
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      </div>
    );
  }

  const username = user?.user_metadata?.username ?? "Player";
  const email = user?.email ?? "Not set";
  const dateOfBirth = user?.user_metadata?.date_of_birth ?? "Not set";
  const avatarId = user?.user_metadata?.avatar_id ?? "avatar-1";
  const lastUsernameChangeAt = user?.user_metadata?.last_username_change_at as string | undefined;
  const lastChangeDate = lastUsernameChangeAt ? new Date(lastUsernameChangeAt) : null;
  const now = new Date();
  const canChangeUsername =
    !lastChangeDate || (now.getTime() - lastChangeDate.getTime()) / (1000 * 60 * 60 * 24) >= 30;
  const nextChangeDate = lastChangeDate
    ? new Date(lastChangeDate.getTime() + 30 * 24 * 60 * 60 * 1000)
    : null;
  const nextChangeLabel = nextChangeDate?.toLocaleDateString();
  const isDevMode = typeof window !== "undefined" && localStorage.getItem("skillflow_dev_mode") === "true";

  const AVATARS = [
    "avatar-1",
    "avatar-2",
    "avatar-3",
    "avatar-4",
    "avatar-5",
    "avatar-6",
    "avatar-7",
    "avatar-8",
  ];

  async function handleAvatarSelect(id: string) {
    if (!user) return;
    setAvatarSaving(true);
    try {
      const supabase = createClient();
      if (!supabase) return;
      const userId = user.id as string;
      await supabase.from("profiles").update({ avatar_id: id }).eq("id", userId);
      await supabase.auth.updateUser({
        data: {
          ...(user.user_metadata ?? {}),
          avatar_id: id,
        },
      });
      setUser((prev: any) =>
        prev ? { ...prev, user_metadata: { ...(prev.user_metadata ?? {}), avatar_id: id } } : prev,
      );
    } finally {
      setAvatarSaving(false);
    }
  }

  async function handleSaveUsername() {
    if (!user || !canChangeUsername || !usernameInput.trim() || !usernamePassword) return;
    setUsernameSaving(true);
    setUsernameError(null);
    try {
      const supabase = createClient();
      if (!supabase) return;
      const emailAddr = user.email as string | undefined;
      if (!emailAddr) {
        setUsernameError("Missing email on account.");
        return;
      }
      const signInRes = await supabase.auth.signInWithPassword({
        email: emailAddr,
        password: usernamePassword,
      });
      if (signInRes.error) {
        setUsernameError("Incorrect password.");
        return;
      }
      const userId = user.id as string;
      const nowIso = new Date().toISOString();
      await supabase.from("profiles").update({ username: usernameInput.trim() }).eq("id", userId);
      const { data, error } = await supabase.auth.updateUser({
        data: {
          ...(user.user_metadata ?? {}),
          username: usernameInput.trim(),
          last_username_change_at: nowIso,
        },
      });
      if (error) {
        setUsernameError(error.message ?? "Failed to update username.");
        return;
      }
      if (data?.user) {
        setUser(data.user);
      }
      setShowUsernameModal(false);
      setUsernamePassword("");
    } catch (err: any) {
      setUsernameError(err?.message ?? "Failed to update username.");
    } finally {
      setUsernameSaving(false);
    }
  }

  async function handleSavePassword() {
    if (!user || !passwordCurrent || !passwordNew || passwordNew !== passwordConfirm) return;
    setPasswordSaving(true);
    setPasswordError(null);
    try {
      const supabase = createClient();
      if (!supabase) return;
      const emailAddr = user.email as string | undefined;
      if (!emailAddr) {
        setPasswordError("Missing email on account.");
        return;
      }
      const signInRes = await supabase.auth.signInWithPassword({
        email: emailAddr,
        password: passwordCurrent,
      });
      if (signInRes.error) {
        setPasswordError("Current password is incorrect.");
        return;
      }
      const { error } = await supabase.auth.updateUser({
        password: passwordNew,
      });
      if (error) {
        setPasswordError(error.message ?? "Failed to update password.");
        return;
      }
      setShowPasswordModal(false);
      setPasswordCurrent("");
      setPasswordNew("");
      setPasswordConfirm("");
    } catch (err: any) {
      setPasswordError(err?.message ?? "Failed to update password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  }

  async function handleConfirmDelete() {
    if (!user) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const supabase = createClient();
      if (!supabase) return;
      const userId = user.id as string;
      await supabase.from("profiles").delete().eq("id", userId);
      await supabase.auth.signOut();
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } catch (err: any) {
      setDeleteError(err?.message ?? "Failed to delete account.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-charcoal">
      <div className="pointer-events-none fixed inset-0 bg-mesh-gradient bg-grid-pattern" aria-hidden />
      <AppNavbar
        username={username}
        isDevMode={!!isDevMode}
        onLogout={() => {}}
        loggingOut={false}
        currentPage="settings"
      />
      <main className="settings-page-default mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>

        {/* 1. Profile */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-white">Profile</h2>
          <p className="mt-1 text-sm text-body-gray">Basic account information and avatar.</p>
          <div className="mt-4 grid gap-6 md:grid-cols-[2fr,1.5fr]">
            <div className="rounded-xl border border-steel-blue bg-card p-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-body-gray">Username</p>
                <p className="mt-1 text-sm text-white">{username}</p>
              </div>
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide text-body-gray">Email</p>
                <p className="mt-1 text-sm text-white break-all">{email}</p>
              </div>
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide text-body-gray">Date of birth</p>
                <p className="mt-1 text-sm text-white">{dateOfBirth}</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowUsernameModal(true);
                    setUsernameInput(username);
                  }}
                  disabled={!canChangeUsername}
                  className="rounded-lg border border-steel-blue px-4 py-2 text-sm font-medium text-white hover:bg-steel-blue/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Change username
                </button>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(true)}
                  className="rounded-lg border border-steel-blue px-4 py-2 text-sm font-medium text-white hover:bg-steel-blue/20"
                >
                  Change password
                </button>
              </div>
              {!canChangeUsername && nextChangeLabel && (
                <p className="mt-3 text-xs text-body-gray">
                  You can change your username again on{" "}
                  <span className="text-primary-text">{nextChangeLabel}</span>.
                </p>
              )}
            </div>
            <div className="rounded-xl border border-steel-blue bg-card p-5">
              <p className="text-sm font-semibold text-white">Avatar</p>
              <p className="mt-1 text-xs text-body-gray">
                Choose a preset avatar. This will show in the nav bar and in-game.
              </p>
              <div className="mt-4 grid grid-cols-4 gap-3">
                {AVATARS.map((id) => {
                  const selected = id === avatarId;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleAvatarSelect(id)}
                      className={`flex h-14 w-14 items-center justify-center rounded-full border text-sm font-semibold transition-all ${
                        selected
                          ? "border-teal bg-teal text-charcoal"
                          : "border-steel-blue bg-charcoal text-primary-text hover:border-steel-blue-bright"
                      }`}
                      disabled={avatarSaving && !selected}
                      aria-pressed={selected}
                    >
                      {id.replace("avatar-", "").toUpperCase()}
                    </button>
                  );
                })}
              </div>
              {avatarSaving && (
                <p className="mt-3 text-xs text-body-gray">Saving avatar…</p>
              )}
            </div>
          </div>
        </section>

        {/* 2. Responsible Gaming (unchanged) */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-white">Responsible Gaming</h2>
          <p className="mt-1 text-sm text-body-gray">Set deposit limits, cool-off periods, and self-exclusion.</p>
          <Link
            href="/settings/responsible-gaming"
            className={`mt-4 inline-flex items-center gap-2 rounded-xl border border-steel-blue bg-card px-5 py-3 text-white transition-colors ${
              isPractice
                ? "hover:border-purple-500/40 hover:bg-purple-500/5"
                : "hover:border-steel-blue-bright hover:bg-steel-blue/10"
            }`}
          >
            Gaming Limits
          </Link>
        </section>

        {/* 3. Referrals (unchanged) */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-white">Referrals</h2>
          <p className="mt-1 text-sm text-body-gray">Invite friends and earn $5 for each one who deposits.</p>
          <Link
            href="/referrals"
            className={`mt-4 inline-flex items-center gap-2 rounded-xl border border-steel-blue bg-card px-5 py-3 text-white transition-colors ${
              isPractice
                ? "hover:border-purple-500/40 hover:bg-purple-500/5"
                : "hover:border-steel-blue-bright hover:bg-steel-blue/10"
            }`}
          >
            Referrals
          </Link>
        </section>

        {/* 4. Notifications (coming soon) */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-white">
            Notifications <span className="ml-2 text-xs font-normal text-body-gray">(coming soon)</span>
          </h2>
          <p className="mt-1 text-sm text-body-gray">
            Manage how we notify you about matches and account activity.
          </p>
          <div className="mt-4 space-y-4 rounded-xl border border-steel-blue bg-card p-4 opacity-60 pointer-events-none">
            {["Match updates", "Friend activity", "Promotions", "Reminders"].map((label) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-white">{label}</span>
                <span className="inline-flex h-6 w-11 shrink-0 rounded-full bg-white/10">
                  <span className="inline-block h-5 w-5 translate-y-0.5 translate-x-0.5 rounded-full bg-white/40" />
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Danger Zone */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-white">Danger Zone</h2>
          <p className="mt-1 text-sm text-body-gray">Manage account termination and sign-out.</p>
          <div className="mt-4 space-y-3 rounded-xl border border-red-500/40 bg-card/60 p-4">
            <button
              type="button"
              onClick={() => {
                setShowDeleteModal(true);
                setDeleteConfirmText("");
              }}
              className="w-full rounded-lg border border-red-500/60 px-4 py-3 text-left text-sm font-medium text-red-400 hover:bg-red-500/10"
            >
              Delete account
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-lg border border-steel-blue px-4 py-3 text-left text-sm font-medium text-white hover:bg-steel-blue/10"
            >
              Log out
            </button>
          </div>
        </section>

        <div className="mt-10">
          <Link
            href="/dashboard"
            className="inline-block rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
          >
            Back to Dashboard
          </Link>
        </div>
      </main>
      {/* Change username modal */}
      {showUsernameModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-steel-blue bg-[#242430] p-6">
            <h2 className="text-lg font-semibold text-white">Change username</h2>
            <p className="mt-1 text-sm text-body-gray">
              You can change your username once every 30 days.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-body-gray">New username</label>
                <input
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-steel-blue bg-card px-3 py-2 text-sm text-white outline-none focus:border-teal"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-body-gray">Current password</label>
                <input
                  type="password"
                  value={usernamePassword}
                  onChange={(e) => setUsernamePassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-steel-blue bg-card px-3 py-2 text-sm text-white outline-none focus:border-teal"
                />
              </div>
              {usernameError && (
                <p className="text-xs text-red-400">{usernameError}</p>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowUsernameModal(false);
                  setUsernameError(null);
                  setUsernamePassword("");
                }}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  usernameSaving ||
                  !canChangeUsername ||
                  !usernameInput.trim() ||
                  !usernamePassword
                }
                onClick={handleSaveUsername}
                className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-charcoal hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {usernameSaving ? "Saving..." : "Save username"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change password modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-steel-blue bg-[#242430] p-6">
            <h2 className="text-lg font-semibold text-white">Change password</h2>
            <p className="mt-1 text-sm text-body-gray">
              Enter your current password and a new password.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-body-gray">Current password</label>
                <input
                  type="password"
                  value={passwordCurrent}
                  onChange={(e) => setPasswordCurrent(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-steel-blue bg-card px-3 py-2 text-sm text-white outline-none focus:border-teal"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-body-gray">New password</label>
                <input
                  type="password"
                  value={passwordNew}
                  onChange={(e) => setPasswordNew(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-steel-blue bg-card px-3 py-2 text-sm text-white outline-none focus:border-teal"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-body-gray">Confirm new password</label>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-steel-blue bg-card px-3 py-2 text-sm text-white outline-none focus:border-teal"
                />
              </div>
              {passwordError && (
                <p className="text-xs text-red-400">{passwordError}</p>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordError(null);
                  setPasswordCurrent("");
                  setPasswordNew("");
                  setPasswordConfirm("");
                }}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  passwordSaving ||
                  !passwordCurrent ||
                  !passwordNew ||
                  passwordNew !== passwordConfirm
                }
                onClick={handleSavePassword}
                className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-charcoal hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {passwordSaving ? "Saving..." : "Save password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete account modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-steel-blue bg-[#242430] p-6">
            <h2 className="text-lg font-semibold text-white">Delete account</h2>
            <p className="mt-1 text-sm text-body-gray">
              This will permanently delete your account, game history, and any remaining balance. This action
              cannot be undone.
            </p>
            <p className="mt-3 text-xs text-body-gray">
              Type <span className="font-mono text-red-400">DELETE</span> to confirm.
            </p>
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="mt-2 w-full rounded-lg border border-steel-blue bg-card px-3 py-2 text-sm text-white outline-none focus:border-red-500"
            />
            {deleteError && (
              <p className="mt-2 text-xs text-red-400">{deleteError}</p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteError(null);
                  setDeleteConfirmText("");
                }}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading || deleteConfirmText !== "DELETE"}
                onClick={handleConfirmDelete}
                className="rounded-lg border border-red-500 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleteLoading ? "Deleting..." : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
