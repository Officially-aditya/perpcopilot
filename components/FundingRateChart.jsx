"use client";

import {
  CartesianGrid,
  ComposedChart,
  Area,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatPct(value) {
  return `${value.toFixed(3)}%`;
}

function buildMarkerNote(marker) {
  return `Last time rate was here: ${marker.after48hPct >= 0 ? "+" : ""}${marker.after48hPct.toFixed(
    1
  )}% in 48h`;
}

function TooltipBody({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const ratePoint = payload.find((item) => item.dataKey === "ratePct");
  const markerPoint = payload.find((item) => item.dataKey === "markerRatePct");

  return (
    <div className="chart-tooltip">
      <div className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-textSecondary">
        {label}
      </div>
      {ratePoint ? <div>Funding: {formatPct(ratePoint.value)}</div> : null}
      {markerPoint?.payload?.markerNote ? (
        <div className="mt-2 text-[rgba(240,240,240,0.72)]">{markerPoint.payload.markerNote}</div>
      ) : null}
    </div>
  );
}

export default function FundingRateChart({ market, analysis, annotation }) {
  const markerMap = new Map(
    analysis.historicalComparisons.map((comparison) => [
      comparison.timestamp,
      {
        markerRatePct: comparison.ratePct,
        markerNote: buildMarkerNote(comparison),
      },
    ])
  );

  const data = market.fundingHistory.map((point) => ({
    ...point,
    positiveRate: point.ratePct >= 0 ? point.ratePct : null,
    negativeRate: point.ratePct < 0 ? point.ratePct : null,
    markerRatePct: markerMap.get(point.timestamp)?.markerRatePct ?? null,
    markerNote: markerMap.get(point.timestamp)?.markerNote ?? null,
  }));

  const currentPoint = data.at(-1);
  const values = data.map((point) => point.ratePct);
  const maxValue = Math.max(...values, analysis.percentileThresholdPct);
  const minValue = Math.min(...values);

  return (
    <section className="detail-section">
      <div className="mb-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="detail-title mb-2">Funding Rate — 30 Days</p>
          </div>
        </div>
      </div>

      <div className="detail-chart-wrap relative h-[170px] p-2">
        {currentPoint ? (
          <div className="pointer-events-none absolute right-4 top-3 z-10 h-3 w-3 rounded-full bg-[#ff6b6b]" />
        ) : null}

        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="positiveFunding" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff1744" stopOpacity={0.38} />
                <stop offset="100%" stopColor="#ff1744" stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="negativeFunding" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00e676" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#00e676" stopOpacity={0.3} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke="#1a1a1a" strokeDasharray="2 4" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#666666", fontFamily: "var(--font-jetbrains-mono)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={18}
            />
            <YAxis
              tickFormatter={(value) => `${value.toFixed(2)}%`}
              tick={{ fill: "#666666", fontFamily: "var(--font-jetbrains-mono)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              domain={[minValue - 0.01, maxValue + 0.02]}
            />
            <Tooltip content={<TooltipBody />} />

            <ReferenceArea
              y1={analysis.percentileThresholdPct}
              y2={maxValue + 0.02}
              fill="#8b3a2f"
              fillOpacity={0.22}
            />

            {currentPoint ? (
              <ReferenceLine
                y={currentPoint.ratePct}
                stroke="#d89e22"
                strokeDasharray="4 4"
                strokeOpacity={0.9}
              />
            ) : null}

            <Area
              type="monotone"
              dataKey="negativeRate"
              stroke="#707070"
              fill="url(#negativeFunding)"
              strokeWidth={1.8}
              connectNulls
              isAnimationActive
            />
            <Area
              type="monotone"
              dataKey="positiveRate"
              stroke="#8b4a45"
              fill="url(#positiveFunding)"
              strokeWidth={1.8}
              connectNulls
              isAnimationActive
            />
            <Line
              type="monotone"
              dataKey="ratePct"
              stroke="#585858"
              strokeOpacity={0.5}
              dot={false}
              strokeWidth={1}
            />
            <Scatter dataKey="markerRatePct" fill="#7b7b7b" shape="diamond" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center justify-between text-[0.72rem] uppercase tracking-[0.16em] text-[rgba(255,255,255,0.26)]">
        <span>30d ago</span>
        <span className="detail-mono text-[#d89e22]">— 80th pct threshold</span>
        <span>now</span>
      </div>

      <div className="mt-6 space-y-2">
        {analysis.historicalComparisons.slice(0, 3).map((comparison) => (
          <div
            key={comparison.timestamp}
            className="detail-mono text-[2rem] leading-none tracking-[0.02em] text-[rgba(255,255,255,0.28)]"
          >
            {comparison.date}: {comparison.after48hPct >= 0 ? "+" : ""}
            {comparison.after48hPct.toFixed(1)}% in 48h
          </div>
        ))}
      </div>
    </section>
  );
}
