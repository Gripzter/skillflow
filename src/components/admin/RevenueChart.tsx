"use client";

import { useMemo, useState, useCallback } from "react";

export interface RevenueDataPoint {
  date: string;
  amount: number;
  label: string;
}

interface RevenueChartProps {
  data: RevenueDataPoint[];
  height?: number;
  showTotal?: boolean;
  totalLabel?: string;
  averageLabel?: string;
  totalValue?: number;
  averageValue?: number;
  color?: string;
}

export default function RevenueChart({
  data,
  height = 280,
  showTotal = true,
  totalLabel = "Total this month",
  averageLabel = "Average daily",
  totalValue,
  averageValue,
  color = "#FFFF00",
}: RevenueChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const padding = { top: 20, right: 20, bottom: 40, left: 56 };
  const width = 800;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const { path, fillPath, points, yTicks, xTicks, minY, maxY } = useMemo(() => {
    if (!data.length) {
      return { path: "", fillPath: "", points: [], yTicks: [], xTicks: [], minY: 0, maxY: 100 };
    }
    const values = data.map((d) => d.amount);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const minY = Math.floor(minVal / 100) * 100;
    const maxY = Math.ceil(maxVal / 100) * 100 + 100;
    const range = maxY - minY || 1;

    const points = data.map((d, i) => {
      const x = padding.left + (i / (data.length - 1 || 1)) * chartWidth;
      const y = padding.top + chartHeight - ((d.amount - minY) / range) * chartHeight;
      return { ...d, x, y, i };
    });

    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const fillD = `${pathD} L ${points[points.length - 1]?.x} ${padding.top + chartHeight} L ${points[0]?.x} ${padding.top + chartHeight} Z`;

    const yStep = range / 4;
    const yTicks = [0, 1, 2, 3, 4].map((i) => minY + i * yStep);
    const xStep = Math.max(1, Math.floor(data.length / 6));
    const xTicks = data.filter((_, i) => i % xStep === 0).map((d, i) => ({ label: d.label, i: i * xStep }));

    return { path: pathD, fillPath: fillD, points, yTicks, xTicks, minY, maxY };
  }, [data, chartWidth, chartHeight, padding.left, padding.top]);

  const formatY = useCallback((v: number) => `$${v.toFixed(0)}`, []);

  const total = totalValue ?? data.reduce((s, d) => s + d.amount, 0);
  const avg = averageValue ?? (data.length ? total / data.length : 0);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[400px] max-w-full"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id="admin-revenue-gradient" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {/* Y-axis labels */}
        {yTicks.map((tick, i) => {
          const y = padding.top + chartHeight - (i / (yTicks.length - 1 || 1)) * chartHeight;
          return (
            <text
              key={tick}
              x={padding.left - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-admin-body text-[10px]"
            >
              {formatY(tick)}
            </text>
          );
        })}
        {/* X-axis labels */}
        {xTicks.map(({ label, i }) => {
          const pt = points[i];
          if (!pt) return null;
          return (
            <text
              key={i}
              x={pt.x}
              y={height - 8}
              textAnchor="middle"
              className="fill-admin-body text-[10px]"
            >
              {label}
            </text>
          );
        })}
        {/* Fill under line */}
        <path d={fillPath} fill="url(#admin-revenue-gradient)" />
        {/* Line */}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Data points and tooltips */}
        {points.map((pt) => (
          <g key={pt.i}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r={hoveredIndex === pt.i ? 6 : 4}
              fill={color}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIndex(pt.i)}
            />
            {hoveredIndex === pt.i && (
              <g>
                <rect
                  x={pt.x - 52}
                  y={pt.y - 36}
                  width={104}
                  height={28}
                  rx={4}
                  fill="#12131A"
                  stroke={color}
                  strokeWidth={1}
                />
                <text x={pt.x} y={pt.y - 18} textAnchor="middle" className="fill-white text-xs">
                  {pt.date}: ${pt.amount.toFixed(2)}
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>
      {showTotal && (
        <p className="mt-2 text-sm text-admin-body">
          {totalLabel}: ${total.toFixed(2)} | {averageLabel}: ${avg.toFixed(2)}
        </p>
      )}
    </div>
  );
}
