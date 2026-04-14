"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function buildData(comparison, asset) {
  const baseHistory = (comparison[asset] || comparison.BTC).fundingHistory.slice(-14);
  const btcByTimestamp = new Map(
    comparison.BTC.fundingHistory.slice(-14).map((point) => [point.timestamp, point])
  );
  const ethByTimestamp = new Map(
    comparison.ETH.fundingHistory.slice(-14).map((point) => [point.timestamp, point])
  );
  const selectedByTimestamp = new Map(
    (comparison[asset] || comparison.BTC).fundingHistory
      .slice(-14)
      .map((point) => [point.timestamp, point])
  );

  return baseHistory.map((point) => {
    const btcPoint = btcByTimestamp.get(point.timestamp);
    const ethPoint = ethByTimestamp.get(point.timestamp);
    const selectedPoint = selectedByTimestamp.get(point.timestamp);
    return {
      label: point.label,
      selectedRatePct: selectedPoint?.ratePct ?? null,
      btcRatePct: btcPoint?.ratePct ?? null,
      ethRatePct: ethPoint?.ratePct ?? null,
    };
  });
}

function TooltipBody({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-textSecondary">
        {label}
      </div>
      {payload.map((item) => (
        <div key={item.dataKey}>
          {item.name}: {item.value.toFixed(3)}%
        </div>
      ))}
    </div>
  );
}

function formatRate(rate) {
  const value = (rate * 100).toFixed(3);
  return `${rate > 0 ? "+" : ""}${value}%`;
}

export default function CrossAssetChart({ asset, comparison, insight }) {
  const data = buildData(comparison, asset);
  const displaySelectedLine = asset !== "BTC" && asset !== "ETH";
  const displayedAssets = displaySelectedLine ? [asset, "BTC", "ETH"] : ["BTC", "ETH"];
  const crowdedAsset = displayedAssets.reduce((leader, symbol) =>
    comparison[symbol].currentFundingRate > comparison[leader].currentFundingRate ? symbol : leader
  );

  return (
    <section className="detail-section">
      <div className="mb-5 flex flex-col gap-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="detail-title mb-2">
              {displaySelectedLine ? `${asset} vs BTC/ETH — Funding Comparison (14 Days)` : "BTC vs ETH — Funding Comparison (14 Days)"}
            </p>
          </div>
        </div>
      </div>

      <div className="detail-chart-wrap h-[130px] p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
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
            />
            <Tooltip content={<TooltipBody />} />
            {displaySelectedLine ? (
              <Line
                type="monotone"
                dataKey="selectedRatePct"
                name={asset}
                stroke="#9cff93"
                strokeWidth={2}
                dot={false}
                isAnimationActive
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="btcRatePct"
              name="BTC"
              stroke="#d7d7d7"
              strokeWidth={2}
              dot={false}
              isAnimationActive
            />
            <Line
              type="monotone"
              dataKey="ethRatePct"
              name="ETH"
              stroke="#d89e22"
              strokeWidth={2}
              dot={false}
              isAnimationActive
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-6 text-sm">
          {displaySelectedLine ? (
            <span className="detail-mono text-[#9cff93]">
              — {asset} {formatRate(comparison[asset].currentFundingRate)}
            </span>
          ) : null}
          <span className="detail-mono text-[#d7d7d7]">— BTC {formatRate(comparison.BTC.currentFundingRate)}</span>
          <span className="detail-mono text-[#d89e22]">— ETH {formatRate(comparison.ETH.currentFundingRate)}</span>
        </div>
        <div className="detail-mono bg-[rgba(90,20,20,0.42)] px-4 py-2 text-[#ff5a4a]">
          {crowdedAsset} more crowded
        </div>
      </div>
      <p className="mt-5 max-w-3xl text-sm leading-7 text-[rgba(255,255,255,0.66)]">{insight}</p>
    </section>
  );
}
