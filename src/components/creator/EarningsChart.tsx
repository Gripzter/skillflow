"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CreatorDailyStat } from "@/hooks/useCreatorData";

type EarningsChartProps = {
  data: CreatorDailyStat[];
};

export default function EarningsChart({ data }: EarningsChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#2A2A38" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#7A7A8E", fontSize: 11 }}
            axisLine={{ stroke: "#2A2A38" }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: "#7A7A8E", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: "#7A7A8E", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#1A1A1F",
              border: "1px solid #2A2A38",
              borderRadius: 8,
              color: "#F0F0F4",
            }}
            labelStyle={{ color: "#C8C8D4" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#C8C8D4" }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="matches"
            name="matches"
            stroke="#F0F0F4"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="earningsSK"
            name="earnings (sk)"
            stroke="#FFFF00"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
