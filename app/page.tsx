"use client";

import { startTransition, useEffect, useState } from "react";
import CrossAssetChart from "../components/CrossAssetChart.jsx";
import FundingRateChart from "../components/FundingRateChart.jsx";
import LoadingSequence from "../components/LoadingSequence.jsx";
import MarketContext from "../components/MarketContext.jsx";
import MetricsBar from "../components/MetricsBar.jsx";
import PriceFundingDivergenceChart from "../components/PriceFundingDivergenceChart.jsx";
import QueryInput from "../components/QueryInput";
import RecommendationCard from "../components/RecommendationCard.jsx";
import RiskFactors from "../components/RiskFactors.jsx";

type HistoricalComparison = {
  timestamp: number;
  date: string;
  after24hPct: number;
  after48hPct: number;
  after72hPct: number;
};

type Analysis = {
  percentile: number;
  historicalComparisons: HistoricalComparison[];
};

type Recommendation = {
  suggested_entry: string | null;
  suggested_stop_loss: string | null;
  time_horizon: string;
  funding_rate_insight: string;
  summary: string;
  chart_annotation: string;
  divergence_insight: string;
  cross_asset_insight: string;
  market_context: string;
  risk_factors: string[];
};

type ResultData = {
  asset: string;
  market: {
    currentPrice: number;
    currentFundingRate: number;
  };
  analysis: Analysis;
  recommendation: Recommendation;
  comparison: unknown;
  news: unknown[];
  meta: {
    demoMode: boolean;
  };
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function HistoricalComparisonTable({ analysis }: { analysis: Analysis }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left">
        <thead>
          <tr className="text-xs uppercase tracking-[0.22em] text-[#00e3fd]">
            <th className="py-3 pr-8 font-mono">When rate was here</th>
            <th className="py-3 pr-8 font-mono">24h after</th>
            <th className="py-3 pr-8 font-mono">48h after</th>
            <th className="py-3 font-mono">72h after</th>
          </tr>
        </thead>
        <tbody>
          {analysis.historicalComparisons.map((item) => (
            <tr
              key={item.timestamp}
              className="text-sm text-textPrimary"
            >
              <td className="py-4 pr-8 font-mono text-[#ffffff]">{item.date}</td>
              <td className="py-4 pr-8">{formatSigned(item.after24hPct)}</td>
              <td className="py-4 pr-8">{formatSigned(item.after48hPct)}</td>
              <td className="py-4">{formatSigned(item.after72hPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FundingInsightCard({ result }: { result: ResultData }) {
  return (
    <section className="console-section p-8">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="console-kicker mb-2">Funding Insight</p>
          <h3 className="console-headline text-textPrimary">How Expensive The Current Carry Regime Is</h3>
        </div>
        <div className="text-right">
          <p className="console-kicker mb-1">Current Percentile</p>
          <p className="console-monodata text-2xl text-[#9cff93]">{result.analysis.percentile}th</p>
        </div>
      </div>

      <p className="console-hanging mb-10 text-base leading-8 text-[rgba(255,255,255,0.8)]">
        {result.recommendation.funding_rate_insight}
      </p>

      <HistoricalComparisonTable analysis={result.analysis} />
    </section>
  );
}

function TradeSetupCard({ recommendation }: { recommendation: Recommendation }) {
  return (
    <section className="console-section h-full p-8">
      <p className="console-kicker mb-2">Trade Setup</p>
      <h3 className="console-headline mb-10 text-textPrimary">Execution Framing</h3>

      <div className="console-subvoid">
        <div>
          <p className="console-kicker mb-2">Suggested Entry</p>
          <p className="text-lg text-textPrimary">
            {recommendation.suggested_entry || "Stand aside"}
          </p>
        </div>
        <div>
          <p className="console-kicker mb-2">Stop Loss</p>
          <p className="text-lg text-textPrimary">
            {recommendation.suggested_stop_loss || "N/A"}
          </p>
        </div>
        <div>
          <p className="console-kicker mb-2">Time Horizon</p>
          <p className="text-base leading-7 text-[rgba(240,240,240,0.8)]">
            {recommendation.time_horizon}
          </p>
        </div>
        <p className="console-kicker text-[#777575]">AI-generated analysis. Not financial advice.</p>
      </div>
    </section>
  );
}

function ErrorCard({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="console-shell">
      <div className="console-main flex min-h-screen max-w-4xl items-center justify-center">
        <div className="console-section w-full p-10">
          <p className="console-kicker mb-3 text-[#ff7351]">Run Failed</p>
          <h2 className="console-display mb-6 text-left text-[#ff7351]">Analysis Error</h2>
          <p className="console-hanging mb-10 max-w-2xl text-base leading-8 text-[rgba(255,255,255,0.8)]">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="console-button-primary px-5 py-3 text-sm transition hover:opacity-90"
        >
          Try Again
        </button>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [asset, setAsset] = useState<"BTC" | "ETH">("BTC");
  const [query, setQuery] = useState("Should I long BTC right now?");
  const [view, setView] = useState("input");
  const [loadingStage, setLoadingStage] = useState(0);
  const [result, setResult] = useState<ResultData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (view !== "loading") return undefined;

    setLoadingStage(0);
    const interval = window.setInterval(() => {
      setLoadingStage((current) => Math.min(current + 1, 3));
    }, 700);

    return () => window.clearInterval(interval);
  }, [view]);

  async function handleSubmit(nextQuery: string) {
    const payload = {
      query: nextQuery,
      asset,
    };

    setError("");
    setView("loading");

    try {
      const responsePromise = fetch("/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const minimumDelay = new Promise((resolve) => {
        window.setTimeout(resolve, 2400);
      });

      const [response] = await Promise.all([responsePromise, minimumDelay]);
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || "Unable to generate analysis.");
      }

      startTransition(() => {
        setResult(json.data);
        setView("result");
      });
    } catch (requestError) {
      const nextError =
        requestError instanceof Error ? requestError.message : "Something went wrong.";
      setError(nextError);
      setView("error");
    }
  }

  if (view === "loading") {
    return <LoadingSequence activeStep={loadingStage} />;
  }

  if (view === "error") {
    return (
      <ErrorCard
        error={error}
        onRetry={() => {
          setView("input");
        }}
      />
    );
  }

  if (view !== "result" || !result) {
    return (
      <QueryInput
        query={query}
        asset={asset}
        isLoading={false}
        onQueryChange={setQuery}
        onAssetChange={setAsset}
        onSubmit={handleSubmit}
      />
    );
  }

  return (
    <div className="console-shell">
      <div className="kinetic-wireframe pointer-events-none absolute inset-0 z-0 opacity-15" />
      <div className="kinetic-scanline pointer-events-none absolute inset-0 z-0 opacity-20" />
      <div className="console-main !max-w-[1260px]">
        <div className="mb-8 flex items-center justify-between gap-6">
          <div>
            <p className="detail-title mb-2">PerpCopilot</p>
            <p className="detail-mono text-sm uppercase tracking-[0.16em] text-[rgba(255,255,255,0.26)]">
              Detail View
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setView("input");
              setResult(null);
            }}
            className="detail-mono text-sm uppercase tracking-[0.18em] text-[rgba(255,255,255,0.4)] transition hover:text-white"
          >
            Ask another question
          </button>
        </div>

        <div className="detail-shell">
          <MetricsBar asset={result.asset} market={result.market} />

          <div className="detail-divider">
            <RecommendationCard recommendation={result.recommendation} />
          </div>

          <div className="detail-divider grid lg:grid-cols-[1fr_1fr]">
            <div className="detail-grid-divider">
              <FundingRateChart
                market={result.market}
                analysis={result.analysis}
                annotation={result.recommendation.chart_annotation}
              />
            </div>
            <FundingInsightCard result={result} />
          </div>

          <div className="detail-divider grid lg:grid-cols-[1fr_1fr]">
            <div className="detail-grid-divider">
              <PriceFundingDivergenceChart
                market={result.market}
                analysis={result.analysis}
                insight={result.recommendation.divergence_insight}
              />
            </div>
            <RiskFactors items={result.recommendation.risk_factors} />
          </div>

          <div className="detail-divider">
            <CrossAssetChart
              comparison={result.comparison}
              insight={result.recommendation.cross_asset_insight}
            />
          </div>

          <div className="detail-divider">
            <MarketContext
              context={result.recommendation.market_context}
              news={result.news}
              demoMode={result.meta.demoMode}
            />
          </div>

          <div className="detail-divider">
            <TradeSetupCard recommendation={result.recommendation} />
          </div>
        </div>

        {result.meta.demoMode ? (
          <div className="mx-auto mt-4 max-w-[1180px] text-sm text-[#ff7351]">
            Demo mode is active because live Pacifica data was unavailable.
          </div>
        ) : null}
      </div>
    </div>
  );
}
