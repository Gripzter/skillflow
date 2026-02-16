"use client";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  icon: string;
}

export default function StatCard({ title, value, subtitle, trend, icon }: StatCardProps) {
  const trendColor =
    trend === "up"
      ? "text-admin-success"
      : trend === "down"
        ? "text-admin-danger"
        : "text-admin-body";

  return (
    <div className="rounded-xl border border-white/5 bg-admin-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-admin-body">{title}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          {subtitle && (
            <p className={`mt-1 text-xs ${trendColor}`}>
              {trend === "up" && "↑ "}
              {trend === "down" && "↓ "}
              {subtitle}
            </p>
          )}
        </div>
        <span className="text-2xl" aria-hidden>
          {icon}
        </span>
      </div>
    </div>
  );
}
