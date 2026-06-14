"use client";

type AdminConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmTone?: "danger" | "primary" | "warning";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function AdminConfirmModal({
  open,
  title,
  message,
  confirmLabel = "confirm",
  confirmTone = "primary",
  loading = false,
  onConfirm,
  onCancel,
}: AdminConfirmModalProps) {
  if (!open) return null;

  const toneClass =
    confirmTone === "danger"
      ? "bg-red-500 hover:bg-red-600 text-white"
      : confirmTone === "warning"
        ? "bg-[#FFFF00] text-black hover:opacity-90"
        : "bg-[#FFFF00] text-black hover:opacity-90";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#1A1A1F] p-6">
        <h3 className="text-lg font-semibold lowercase text-white">{title}</h3>
        <p className="mt-3 text-sm text-[#C8C8D4]">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm lowercase text-[#C8C8D4] hover:bg-white/5"
          >
            cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-medium lowercase disabled:opacity-50 ${toneClass}`}
          >
            {loading ? "working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MoneyPair({
  sk,
  usd,
  skClassName = "text-[#FFFF00]",
  usdClassName = "text-[#C8C8D4]",
}: {
  sk: number;
  usd: number;
  skClassName?: string;
  usdClassName?: string;
}) {
  return (
    <span>
      <span className={skClassName}>{Math.round(sk).toLocaleString()} sk</span>
      <span className={`ml-2 text-xs ${usdClassName}`}>(${usd.toFixed(2)})</span>
    </span>
  );
}

export function AdminPageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold lowercase text-white">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm lowercase text-[#7A7A8E]">{subtitle}</p> : null}
    </div>
  );
}

export function AdminTableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#1A1A1F]">
      {children}
    </div>
  );
}

export function statusBadgeClass(status: string): string {
  if (status === "active" || status === "completed") {
    return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  }
  if (status === "in_progress") {
    return "bg-[#FFFF00]/15 text-[#FFFF00] border-[#FFFF00]/30";
  }
  if (status === "forfeited") {
    return "bg-orange-500/15 text-orange-400 border-orange-500/30";
  }
  if (status === "voided") {
    return "bg-red-500/15 text-red-400 border-red-500/30";
  }
  if (status === "timed_out" || status === "cancelled") {
    return "bg-white/5 text-[#7A7A8E] border-white/10";
  }
  if (status === "pending" || status === "suspended") {
    return "bg-[#FFFF00]/15 text-[#FFFF00] border-[#FFFF00]/30";
  }
  return "bg-white/5 text-[#C8C8D4] border-white/10";
}

export function AdminStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium lowercase ${statusBadgeClass(status)}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
