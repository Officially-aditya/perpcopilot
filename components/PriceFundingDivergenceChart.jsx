"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatPct(value) {
  return `${value.toFixed(3)}%`;
}

function TooltipBody({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const price = payload.find((item) => item.dataKey === "price");
  const rate = payload.find((item) => item.dataKey === "ratePct");

  return (
    <div className="chart-tooltip">
      <div className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-textSecondary">
        {label}
      </div>
      {price ? <div>Price: {formatPrice(price.value)}</div> : null}
      {rate ? <div>Funding: {formatPct(rate.value)}</div> : null}
    </div>
  );
}

export default function PriceFundingDivergenceChart({ market, analysis, insight }) {
  const statusLabel =
    analysis.divergence === "diverging"
      ? analysis.divergenceSignal === "overleveraged_longs"
        ? "DIVERGING - Overleveraged Longs"
        : analysis.divergenceSignal === "overleveraged_shorts"
          ? "DIVERGING - Overleveraged Shorts"
          : "DIVERGING"
      : "ALIGNED";

  return (
    <section className="detail-section">
      <div className="mb-5 flex flex-col gap-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="detail-title mb-2">Price vs Funding Divergence</p>
          </div>
          <div
            className={`detail-mono inline-flex px-3 py-2 text-xs uppercase tracking-[0.16em] ${
              analysis.divergence === "diverging"
                ? "bg-[rgba(90,20,20,0.42)] text-[#ff7351]"
                : "bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.62)]"
            }`}
          >
            {analysis.divergence === "diverging" ? "▵ diverging" : "aligned"}
          </div>
        </div>
      </div>

      <div className="detail-chart-wrap h-[170px] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={market.mergedHistory} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1a1a1a" strokeDasharray="2 4" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#666666", fontFamily: "var(--font-jetbrains-mono)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={18}
            />
            <YAxis
              yAxisId="price"
              tickFormatter={(value) => `$${Math.round(value / 1000)}k`}
              tick={{ fill: "#666666", fontFamily: "var(--font-jetbrains-mono)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="funding"
              orientation="right"
              tickFormatter={(value) => `${value.toFixed(2)}%`}
              tick={{ fill: "#666666", fontFamily: "var(--font-jetbrains-mono)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<TooltipBody />} />

            {analysis.divergenceZones.map((zone) => (
              <ReferenceArea
                key={`${zone.start}-${zone.end}`}
                x1={zone.start}
                x2={zone.end}
                fill="#ff7351"
                fillOpacity={0.08}
                label={{ value: "diverging", position: "insideTopRight", fill: "#ff7351", fontSize: 11 }}
              />
            ))}

            <Line
              yAxisId="price"
              type="monotone"
              dataKey="price"
              stroke="#d7d7d7"
              strokeWidth={2}
              dot={false}
              isAnimationActive
            />
            <Line
              yAxisId="funding"
              type="monotone"
              dataKey="ratePct"
              stroke="#d89e22"
              strokeWidth={2}
              dot={false}
              isAnimationActive
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex gap-6 text-sm">
        <span className="detail-mono text-[#d7d7d7]">— price</span>
        <span className="detail-mono text-[#d89e22]">— funding</span>
      </div>
      <p className="mt-5 max-w-2xl text-sm leading-7 text-[rgba(255,255,255,0.66)]">{insight}</p>
    </section>
  );
}
